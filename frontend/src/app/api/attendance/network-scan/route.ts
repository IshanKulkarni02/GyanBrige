import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import { users } from '@/lib/db';
import { lookupVendor } from '@/lib/oui';

export interface ScannedDevice {
  mac: string;
  ip: string;
  hostname: string;
  vendor: string;
  randomized: boolean; // true if MAC appears to be locally-administered (randomized)
  assignedTo: { id: string; name: string } | null;
}

// The second-least-significant bit of the first octet being 1 means locally administered (randomized MAC)
function isRandomizedMac(mac: string): boolean {
  const firstByte = parseInt(mac.split(':')[0], 16);
  return (firstByte & 0x02) !== 0;
}

function normalizeMac(raw: string): string {
  // Split on any separator, pad each octet to 2 digits, rejoin with colons.
  // Handles macOS ARP output like "4:68:65:62:96:99" (missing leading zero).
  const parts = raw.split(/[:\-.]/);
  if (parts.length !== 6) return '';
  const octets = parts.map(p => p.padStart(2, '0').toLowerCase());
  if (octets.some(o => !/^[0-9a-f]{2}$/.test(o))) return '';
  return octets.join(':');
}

// Parse `arp -a` into raw entries (vendor lookup is async, done separately)
function parseArpEntries(output: string): Array<{ mac: string; ip: string; hostname: string }> {
  const lines = output.split('\n').filter(Boolean);
  const entries: Array<{ mac: string; ip: string; hostname: string }> = [];
  const macSet = new Set<string>();

  for (const line of lines) {
    const ipMatch = line.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
    const macMatch = line.match(/at\s+([0-9a-fA-F]{1,2}(?:[:\-][0-9a-fA-F]{1,2}){5})/);
    if (!ipMatch || !macMatch) continue;

    const mac = normalizeMac(macMatch[1]);
    if (!mac || mac === 'ff:ff:ff:ff:ff:ff' || mac === '00:00:00:00:00:00') continue;
    // Skip multicast MACs (LSB of first octet = 1, e.g. 01:00:5e:...)
    if (parseInt(mac.split(':')[0], 16) & 0x01) continue;
    if (macSet.has(mac)) continue;
    macSet.add(mac);

    entries.push({
      mac,
      ip: ipMatch[1],
      hostname: line.split(' ')[0] === '?' ? '' : line.split(' ')[0],
    });
  }
  return entries;
}

// Ping broadcast to refresh ARP cache
function populateArpCache(): void {
  try {
    if (process.platform === 'darwin') {
      const ifaceResult = spawnSync('netstat', ['-rn'], { timeout: 30000 });
      const ifaceLine = ifaceResult.stdout?.toString().split('\n').find(l => l.startsWith('default'));
      const iface = ifaceLine?.trim().split(/\s+/)[5] || 'en0';
      const ipResult = spawnSync('ipconfig', ['getifaddr', iface], { timeout: 30000 });
      const ip = ipResult.stdout?.toString().trim() || '';
      const parts = ip.split('.');
      if (parts.length === 4) {
        spawnSync('ping', ['-c', '2', '-t', '1', `${parts[0]}.${parts[1]}.${parts[2]}.255`], { timeout: 30000 });
      }
    } else {
      const routeResult = spawnSync('ip', ['route', 'show', 'default'], { timeout: 30000 });
      const iface = routeResult.stdout?.toString().match(/dev\s+(\S+)/)?.[1] || 'eth0';
      const addrResult = spawnSync('ip', ['addr', 'show', iface], { timeout: 30000 });
      const ip = addrResult.stdout?.toString().match(/inet\s+([\d.]+)\//)?.[1] || '';
      if (ip) {
        const parts = ip.split('.');
        spawnSync('ping', ['-c', '2', '-W', '1', '-b', `${parts[0]}.${parts[1]}.${parts[2]}.255`], { timeout: 30000 });
      }
    }
  } catch { /* non-fatal */ }
}

export async function GET() {
  try {
    populateArpCache();

    let arpOutput = '';
    try {
      const result = spawnSync('/usr/sbin/arp', ['-a'], { timeout: 30000 });
      if (result.error) throw result.error;
      arpOutput = result.stdout?.toString() || '';
    } catch {
      return NextResponse.json(
        { error: 'arp command unavailable on this server', devices: [], matchedStudents: [], unmatchedStudents: [] },
        { status: 500 }
      );
    }

    const rawEntries = parseArpEntries(arpOutput);
    const allUsers = users.getAll();
    const studentMacMap = new Map(
      allUsers
        .filter(u => u.role === 'student' && u.macAddress)
        .map(u => [normalizeMac(u.macAddress!), { id: u.id, name: u.name }])
    );

    // Resolve vendors in parallel (async — hits API for unknown OUIs)
    const devices: ScannedDevice[] = await Promise.all(
      rawEntries.map(async entry => {
        const randomized = isRandomizedMac(entry.mac);
        const vendor = randomized ? 'Randomized MAC' : await lookupVendor(entry.mac);
        return {
          ...entry,
          vendor,
          randomized,
          assignedTo: studentMacMap.get(entry.mac) ?? null,
        };
      })
    );

    const onlineMacs = devices.map(d => d.mac);

    const matchedStudents = allUsers
      .filter(u => u.role === 'student' && u.macAddress && onlineMacs.includes(normalizeMac(u.macAddress)))
      .map(u => ({ id: u.id, name: u.name, email: u.email }));

    const unmatchedStudents = allUsers
      .filter(u => u.role === 'student' && !u.macAddress)
      .map(u => ({ id: u.id, name: u.name, email: u.email }));

    return NextResponse.json({
      devices,
      onlineMacs,
      matchedStudents,
      unmatchedStudents,
      scannedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Network scan error:', error);
    return NextResponse.json(
      { error: 'Network scan failed', devices: [], matchedStudents: [], unmatchedStudents: [] },
      { status: 500 }
    );
  }
}
