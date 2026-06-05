'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Grievance {
  id: string; title: string; description: string; category: string;
  priority: string; status: string; adminNote: string; createdAt: string;
  submitterName: string; submitterRole: string;
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-500/20 text-amber-400',
  in_review: 'bg-blue-500/20 text-blue-400',
  resolved: 'bg-emerald-500/20 text-emerald-400',
  dismissed: 'bg-white/10 text-white/40',
};
const PRIORITY_COLOR: Record<string, string> = {
  high: 'text-red-400', medium: 'text-amber-400', low: 'text-white/40',
};

export default function AdminGrievances() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [selected, setSelected] = useState<Grievance | null>(null);
  const [note, setNote] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'admin') { router.push('/login'); return; }
    setUser(parsed);
    load();
  }, [router]);

  const load = () => authFetch('/api/grievances').then(r => r.json()).then(d => setGrievances(d.grievances ?? []));

  const openDetail = (g: Grievance) => { setSelected(g); setNote(g.adminNote); setNewStatus(g.status); };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    await authFetch(`/api/grievances/${selected.id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus, adminNote: note }) });
    setSaving(false);
    setSelected(null);
    load();
  };

  const filtered = filter === 'all' ? grievances : grievances.filter(g => g.status === filter);

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📢</div></div>;

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-6 hidden lg:block">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="text-2xl">📚</span><span className="text-xl font-bold gradient-text">GyanBrige</span>
        </Link>
        <nav className="space-y-2">
          {[
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/admin' },
            { icon: '👥', label: 'Users', href: '/dashboard/admin/users' },
            { icon: '🏫', label: 'Courses', href: '/dashboard/admin/courses' },
            { icon: '📅', label: 'Timetable', href: '/dashboard/admin/timetable' },
            { icon: '📢', label: 'Grievances', href: '/dashboard/admin/grievances', active: true },
            { icon: '⭐', label: 'Feedback', href: '/dashboard/admin/feedback' },
            { icon: '🤖', label: 'AI Settings', href: '/dashboard/admin/ai' },
            { icon: '📊', label: 'Analytics', href: '/dashboard/admin/analytics' },
            { icon: '⚙️', label: 'Settings', href: '/dashboard/admin/settings' },
          ].map(item => (
            <Link key={item.label} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${item.active ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/70 hover:bg-white/5'}`}>
              <span>{item.icon}</span><span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <button onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
          className="absolute bottom-6 left-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 transition">
          <span>🚪</span><span>Logout</span>
        </button>
      </aside>

      <main className="lg:ml-64 p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Grievances 📢</h1>
            <p className="text-white/60">Review and respond to submitted grievances</p>
          </div>
          <div className="flex gap-2">
            {['all', 'open', 'in_review', 'resolved'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-sm transition ${filter === f ? 'bg-emerald-500/20 text-emerald-400' : 'glass text-white/60 hover:bg-white/10'}`}>
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Open', value: grievances.filter(g => g.status === 'open').length, color: 'from-amber-500 to-orange-500' },
            { label: 'In Review', value: grievances.filter(g => g.status === 'in_review').length, color: 'from-blue-500 to-indigo-500' },
            { label: 'Resolved', value: grievances.filter(g => g.status === 'resolved').length, color: 'from-emerald-500 to-teal-500' },
            { label: 'Total', value: grievances.length, color: 'from-purple-500 to-pink-500' },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}>
                <span className="text-sm font-bold">{s.value}</span>
              </div>
              <p className="text-white/60 text-sm">{s.label}</p>
            </div>
          ))}
        </div>

        {selected && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-6 w-full max-w-lg">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <span className={`px-3 py-1 rounded-full text-xs ${STATUS_COLOR[selected.status] ?? ''}`}>{selected.status.replace('_', ' ')}</span>
              </div>
              <p className="text-white/40 text-sm mb-3">From {selected.submitterName} ({selected.submitterRole}) · {selected.category} · <span className={PRIORITY_COLOR[selected.priority]}>{selected.priority}</span></p>
              <p className="text-white/80 mb-4 glass rounded-xl p-3">{selected.description}</p>
              <div className="space-y-3">
                <select className="input-glass w-full" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
                <textarea className="input-glass w-full h-24 resize-none" placeholder="Response / note for the submitter…" value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setSelected(null)} className="flex-1 glass py-2 rounded-xl text-white/70 hover:bg-white/10">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save Response'}</button>
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-white/40">No grievances found.</div>
        ) : (
          <div className="glass rounded-xl overflow-hidden">
            {filtered.map((g, i) => (
              <button key={g.id} onClick={() => openDetail(g)}
                className={`w-full text-left flex items-start gap-4 p-4 hover:bg-white/5 transition ${i !== filtered.length - 1 ? 'border-b border-white/10' : ''}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{g.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[g.status] ?? ''}`}>{g.status.replace('_',' ')}</span>
                    <span className={`text-xs ${PRIORITY_COLOR[g.priority]}`}>{g.priority}</span>
                  </div>
                  <p className="text-white/50 text-sm line-clamp-1">{g.description}</p>
                  <p className="text-white/30 text-xs mt-1">{g.submitterName} · {g.category} · {new Date(g.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="text-white/30 text-sm">›</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
