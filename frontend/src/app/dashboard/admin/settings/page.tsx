'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser]   = useState<{ id: string; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [siteName,        setSiteName]        = useState('GyanBrige');
  const [allowSignup,     setAllowSignup]     = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [maxUploadSizeGb, setMaxUploadSizeGb] = useState('25');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch {
      localStorage.removeItem('user');
      router.push('/login'); return;
    }
    if (parsed.role !== 'admin') { router.push('/login'); return; }
    setUser(parsed);
    loadSettings();
  }, [router]);

  const loadSettings = async () => {
    try {
      const res  = await authFetch('/api/settings');
      const data = await res.json();
      setSiteName(data.siteName || 'GyanBrige');
      setAllowSignup(data.allowSignup !== false);
      setRequireApproval(!!data.requireApproval);
      setMaxUploadSizeGb(data.maxUploadSizeGb || '25');
    } catch { toast.error('Failed to load settings'); }
    finally  { setLoading(false); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ siteName, allowSignup, requireApproval, maxUploadSizeGb }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const clearData = async () => {
    const confirmed = window.confirm(
      '⚠️ This will permanently delete ALL users (except admins), courses, lectures, enrollments, and attendance. This cannot be undone.\n\nType OK to confirm.'
    );
    if (!confirmed) return;
    try {
      const res = await authFetch('/api/admin/clear-data', { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('All data cleared');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Clear failed');
    }
  };

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4 animate-pulse">⚙️</div><p className="text-white/60">Loading...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">
        ← Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">⚙️ Settings</h1>
        <p className="text-white/60">Platform configuration — saved to server, applies everywhere</p>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* General */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">General</h2>
          <div>
            <label className="block text-sm text-white/70 mb-2">Site Name</label>
            <input type="text" value={siteName} onChange={e => setSiteName(e.target.value)} className="input-glass" />
          </div>
        </div>

        {/* User Management */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">User Management</h2>
          <div className="space-y-3">
            {[
              { label: 'Allow User Signup', desc: 'Allow new users to self-register', value: allowSignup, set: setAllowSignup },
              { label: 'Require Admin Approval', desc: 'New accounts need admin approval before login', value: requireApproval, set: setRequireApproval },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div><span className="font-medium">{item.label}</span><p className="text-white/50 text-sm">{item.desc}</p></div>
                <button onClick={() => item.set(!item.value)}
                  className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${item.value ? 'bg-emerald-500' : 'bg-white/20'}`}>
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${item.value ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Upload */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Limits</h2>
          <div>
            <label className="block text-sm text-white/70 mb-2">Max video upload size</label>
            <select value={maxUploadSizeGb} onChange={e => setMaxUploadSizeGb(e.target.value)} className="input-glass">
              {['1','5','10','25','50','100'].map(v => <option key={v} value={v}>{v} GB</option>)}
            </select>
          </div>
        </div>

        {/* Save */}
        <button onClick={saveSettings} disabled={saving} className="btn-primary w-full py-4 text-lg disabled:opacity-50">
          {saving ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span>Saving…</span> : '💾 Save Settings'}
        </button>

        {/* Danger Zone */}
        <div className="glass rounded-2xl p-6 border border-red-500/30">
          <h2 className="text-xl font-semibold mb-4 text-red-400">⚠️ Danger Zone</h2>
          <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl">
            <div>
              <span className="font-medium">Clear All Data</span>
              <p className="text-white/50 text-sm">Delete all users, courses, lectures, enrollments</p>
            </div>
            <button onClick={clearData} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-600/30 transition">
              Clear Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
