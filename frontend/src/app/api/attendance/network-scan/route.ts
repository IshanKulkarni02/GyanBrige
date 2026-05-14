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
  const hex = raw.replace(/[:\-.]/g, '').toLowerCase();
  if (hex.length !== 12) return '';
  return hex.match(/.{2}/g)!.join(':');
}

// Parse `arp -a` into structured device list
// macOS/Linux: hostname (ip) at mac on iface ...
function parseArpFull(output: string): ScannedDevice[] {
  const lines = output.split('\n').filter(Boolean);
  const devices: ScannedDevice[] = [];
  const macSet = new Set<string>();

  for (const line of lines) {
    const ipMatch = line.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
    const macMatch = line.match(/at\s+([0-9a-fA-F]{1,2}(?:[:\-][0-9a-fA-F]{1,2}){5})/);
    if (!ipMatch || !macMatch) continue;

    const mac = normalizeMac(macMatch[1]);
    if (!mac || mac === 'ff:ff:ff:ff:ff:ff' || mac === '00:00:00:00:00:00') continue;
    if (macSet.has(mac)) continue;
    macSet.add(mac);

    const ip = ipMatch[1];
    const hostname = line.split(' ')[0] === '?' ? '' : line.split(' ')[0];
    const randomized = isRandomizedMac(mac);
    const vendor = randomized ? 'Randomized MAC' : lookupVendor(mac);

    devices.push({ mac, ip, hostname, vendor, randomized, assignedTo: null });
  }
  return devices;
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

    const devices = parseArpFull(arpOutput);
    const allUsers = users.getAll();
    const studentMacMap = new Map(
      allUsers
        .filter(u => u.role === 'student' && u.macAddress)
        .map(u => [normalizeMac(u.macAddress!), { id: u.id, name: u.name }])
    );

    // Annotate each device with assigned student (if any)
    for (const device of devices) {
      device.assignedTo = studentMacMap.get(device.mac) ?? null;
    }

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
