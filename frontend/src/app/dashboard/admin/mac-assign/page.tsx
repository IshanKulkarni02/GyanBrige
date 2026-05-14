'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ScannedDevice {
  mac: string;
  ip: string;
  hostname: string;
  vendor: string;
  randomized: boolean;
  assignedTo: { id: string; name: string } | null;
}

interface Student {
  id: string;
  name: string;
  email: string;
  macAddress?: string | null;
}

export default function MacAssignPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannedAt, setScannedAt] = useState('');
  const [scanError, setScanError] = useState('');
  const [assigningMac, setAssigningMac] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMac, setSavedMac] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored || JSON.parse(stored).role !== 'admin') {
      router.push('/login');
      return;
    }
    loadStudents();
  }, [router]);

  const loadStudents = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    setStudents((data.users || []).filter((u: Student & { role: string }) => u.role === 'student'));
  };

  const scan = async () => {
    setScanning(true);
    setScanError('');
    setDevices([]);
    try {
      const res = await fetch('/api/attendance/network-scan');
      const data = await res.json();
      if (!res.ok) { setScanError(data.error || 'Scan failed'); return; }
      setDevices(data.devices || []);
      setScannedAt(data.scannedAt);
      // Refresh students to pick up any already-assigned MACs
      await loadStudents();
    } catch {
      setScanError('Network scan failed');
    } finally {
      setScanning(false);
    }
  };

  const assignMac = async (mac: string, studentId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: mac }),
      });
      if (res.ok) {
        setSavedMac(mac);
        setTimeout(() => setSavedMac(''), 3000);
        setAssigningMac(null);
        // Update device list to reflect assignment
        await loadStudents();
        setDevices(prev => prev.map(d =>
          d.mac === mac
            ? { ...d, assignedTo: { id: studentId, name: students.find(s => s.id === studentId)?.name || '' } }
            : d
        ));
      }
    } finally {
      setSaving(false);
    }
  };

  const unassignMac = async (studentId: string) => {
    setSaving(true);
    try {
      await fetch(`/api/users/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: null }),
      });
      await loadStudents();
      setDevices(prev => prev.map(d =>
        d.assignedTo?.id === studentId ? { ...d, assignedTo: null } : d
      ));
    } finally {
      setSaving(false);
    }
  };

  const vendorIcon = (vendor: string) => {
    const v = vendor.toLowerCase();
    if (v.includes('apple')) return '🍎';
    if (v.includes('samsung')) return '📱';
    if (v.includes('xiaomi') || v.includes('redmi') || v.includes('poco')) return '📱';
    if (v.includes('oneplus')) return '📱';
    if (v.includes('oppo') || v.includes('realme')) return '📱';
    if (v.includes('vivo')) return '📱';
    if (v.includes('huawei') || v.includes('honor')) return '📱';
    if (v.includes('google')) return '📱';
    if (v.includes('motorola')) return '📱';
    if (v.includes('nokia')) return '📱';
    if (v.includes('nothing')) return '📱';
    if (v.includes('dell') || v.includes('hp') || v.includes('asus') || v.includes('lenovo')) return '💻';
    return '📡';
  };

  const vendorColor = (vendor: string) => {
    const v = vendor.toLowerCase();
    if (v.includes('apple')) return 'text-slate-300';
    if (v.includes('samsung')) return 'text-blue-400';
    if (v.includes('xiaomi')) return 'text-orange-400';
    if (v.includes('oneplus')) return 'text-red-400';
    if (v.includes('oppo') || v.includes('realme')) return 'text-teal-400';
    if (v.includes('vivo')) return 'text-indigo-400';
    if (v.includes('huawei') || v.includes('honor')) return 'text-rose-400';
    if (v.includes('google')) return 'text-emerald-400';
    if (v === 'unknown device') return 'text-white/30';
    return 'text-white/60';
  };

  const unassignedStudents = students.filter(s => !s.macAddress);

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <Link href="/dashboard/admin/users" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">
        ← Back to Users
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">📡 Scan & Assign MAC</h1>
          <p className="text-white/60">Scan the network to identify student phones and assign MAC addresses</p>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="btn-primary px-6 py-3 flex items-center gap-2 disabled:opacity-50"
        >
          {scanning
            ? <><span className="animate-spin inline-block">⏳</span> Scanning...</>
            : <>📡 Scan Network</>}
        </button>
      </div>

      {/* How it works */}
      {devices.length === 0 && !scanning && !scanError && (
        <div className="glass rounded-2xl p-6 mb-6 border border-white/10">
          <h2 className="font-semibold mb-3">How it works</h2>
          <ol className="space-y-2 text-white/60 text-sm list-decimal list-inside">
            <li>Ask the student to connect their phone to this Wi-Fi network.</li>
            <li><strong className="text-amber-400">Important:</strong> The student must disable MAC address randomization for this network:
              <ul className="ml-6 mt-1 space-y-1 list-disc">
                <li><strong className="text-white">iPhone:</strong> Settings → Wi-Fi → tap ⓘ next to network → turn off "Private Wi-Fi Address"</li>
                <li><strong className="text-white">Android:</strong> Settings → Wi-Fi → long-press network → Manage → Privacy → Use device MAC</li>
              </ul>
            </li>
            <li>Click <strong className="text-white">Scan Network</strong> — the server will detect all connected devices.</li>
            <li>Find the student's phone (identified by brand) and click <strong className="text-white">Assign to Student</strong>.</li>
            <li>The MAC address is saved and used for automatic attendance.</li>
          </ol>
        </div>
      )}

      {scanError && (
        <div className="glass rounded-xl p-4 mb-6 border border-red-500/20 bg-red-500/5">
          <p className="text-red-400">⚠️ {scanError}</p>
        </div>
      )}

      {scannedAt && (
        <p className="text-white/40 text-sm mb-4">
          Last scan: {new Date(scannedAt).toLocaleTimeString()} — {devices.length} device{devices.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Unassigned students warning */}
      {unassignedStudents.length > 0 && devices.length > 0 && (
        <div className="glass rounded-xl p-4 mb-6 border border-amber-500/20 bg-amber-500/5">
          <p className="text-amber-400 text-sm">
            {unassignedStudents.length} student{unassignedStudents.length !== 1 ? 's' : ''} still need a MAC address:{' '}
            {unassignedStudents.map(s => s.name).join(', ')}
          </p>
        </div>
      )}

      {/* Device list */}
      {devices.length > 0 && (
        <div className="space-y-3">
          {devices.map(device => (
            <div key={device.mac} className={`glass rounded-2xl p-5 ${device.randomized ? 'border border-amber-500/20' : ''}`}>
              <div className="flex items-start gap-4">
                {/* Device icon + info */}
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                  {device.randomized ? '❓' : vendorIcon(device.vendor)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className={`font-semibold ${device.randomized ? 'text-amber-400' : vendorColor(device.vendor)}`}>
                      {device.vendor}
                    </span>
                    {device.hostname && (
                      <span className="text-white/40 text-sm">"{device.hostname}"</span>
                    )}
                    {device.assignedTo && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                        ✓ {device.assignedTo.name}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-white/40 font-mono">
                    <span>{device.mac}</span>
                    <span>{device.ip}</span>
                  </div>
                  {device.randomized && (
                    <p className="text-amber-400/70 text-xs mt-1">
                      ⚠️ Randomized MAC — student must disable "Private Wi-Fi Address" for this network before assigning
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0">
                  {device.assignedTo ? (
                    <button
                      onClick={() => unassignMac(device.assignedTo!.id)}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 disabled:opacity-50"
                    >
                      Unassign
                    </button>
                  ) : savedMac === device.mac ? (
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">✓ Saved</span>
                  ) : assigningMac === device.mac ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="input-glass text-sm py-1.5 pr-8"
                        defaultValue=""
                        onChange={e => { if (e.target.value) assignMac(device.mac, e.target.value); }}
                      >
                        <option value="" disabled>Pick student...</option>
                        {students.filter(s => !s.macAddress).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setAssigningMac(null)}
                        className="text-white/40 hover:text-white text-sm"
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAssigningMac(device.mac)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30"
                    >
                      Assign to Student
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
