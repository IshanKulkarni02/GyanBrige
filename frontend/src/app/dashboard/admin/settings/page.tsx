'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  
  // Settings state
  const [siteName, setSiteName] = useState('GyanBrige');
  const [allowSignup, setAllowSignup] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [maxUploadSize, setMaxUploadSize] = useState('100');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'admin') {
        router.push('/login');
      } else {
        setUser(parsed);
        loadSettings();
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const loadSettings = () => {
    const settings = localStorage.getItem('siteSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      setSiteName(parsed.siteName || 'GyanBrige');
      setAllowSignup(parsed.allowSignup !== false);
      setRequireApproval(parsed.requireApproval || false);
      setMaxUploadSize(parsed.maxUploadSize || '100');
      setTheme(parsed.theme || 'dark');
    }
    setLoading(false);
  };

  const saveSettings = () => {
    localStorage.setItem('siteSettings', JSON.stringify({
      siteName,
      allowSignup,
      requireApproval,
      maxUploadSize,
      theme,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">⚙️</div>
          <p className="text-white/60">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">
        ← Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">⚙️ Settings</h1>
        <p className="text-white/60">Configure platform settings</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* General Settings */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">General</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Site Name</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="input-glass"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="input-glass"
              >
                <option value="dark">Dark (Default)</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>
        </div>

        {/* User Settings */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">User Management</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div>
                <span className="font-medium">Allow User Signup</span>
                <p className="text-white/50 text-sm">Allow new users to create accounts</p>
              </div>
              <button
                onClick={() => setAllowSignup(!allowSignup)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  allowSignup ? 'bg-emerald-500' : 'bg-white/20'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  allowSignup ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div>
                <span className="font-medium">Require Admin Approval</span>
                <p className="text-white/50 text-sm">New accounts need admin approval</p>
              </div>
              <button
                onClick={() => setRequireApproval(!requireApproval)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  requireApproval ? 'bg-emerald-500' : 'bg-white/20'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  requireApproval ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Upload Settings */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Settings</h2>
          <div>
            <label className="block text-sm text-white/70 mb-2">Max Upload Size (GB)</label>
            <select
              value={maxUploadSize}
              onChange={(e) => setMaxUploadSize(e.target.value)}
              className="input-glass"
            >
              <option value="1">1 GB</option>
              <option value="5">5 GB</option>
              <option value="10">10 GB</option>
              <option value="50">50 GB</option>
              <option value="100">100 GB</option>
            </select>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="glass rounded-2xl p-6 border border-red-500/30">
          <h2 className="text-xl font-semibold mb-4 text-red-400">⚠️ Danger Zone</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl">
              <div>
                <span className="font-medium">Clear All Data</span>
                <p className="text-white/50 text-sm">Delete all users, courses, and lectures</p>
              </div>
              <button className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition">
                Clear Data
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={saveSettings}
          className={`btn-primary w-full py-4 text-lg ${saved ? 'bg-emerald-600' : ''}`}
        >
          {saved ? '✅ Settings Saved!' : '💾 Save Settings'}
        </button>
      </div>
    </div>
  );
}
