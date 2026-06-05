'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Grievance {
  id: string; title: string; description: string; category: string;
  priority: string; status: string; adminNote: string; createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-500/20 text-amber-400',
  in_review: 'bg-blue-500/20 text-blue-400',
  resolved: 'bg-emerald-500/20 text-emerald-400',
  dismissed: 'bg-white/10 text-white/40',
};

export default function TeacherGrievances() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'academic', priority: 'medium' });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Grievance | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'teacher') { router.push('/login'); return; }
    setUser(parsed);
    load();
  }, [router]);

  const load = () => authFetch('/api/grievances').then(r => r.json()).then(d => setGrievances(d.grievances ?? []));

  const handleSubmit = async () => {
    if (!form.title || !form.description) return;
    setSaving(true);
    await authFetch('/api/grievances', { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    setShowForm(false);
    setForm({ title: '', description: '', category: 'administrative', priority: 'medium' });
    load();
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📢</div></div>;

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-6 hidden lg:block">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="text-2xl">📚</span><span className="text-xl font-bold gradient-text">GyanBrige</span>
        </Link>
        <nav className="space-y-2">
          {[
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/teacher' },
            { icon: '📤', label: 'Upload Lecture', href: '/dashboard/teacher/upload' },
            { icon: '📋', label: 'Attendance', href: '/dashboard/teacher/attendance' },
            { icon: '🎙️', label: 'Record', href: '/dashboard/teacher/record' },
            { icon: '📅', label: 'Timetable', href: '/dashboard/teacher/timetable' },
            { icon: '📝', label: 'Exams', href: '/dashboard/teacher/exams' },
            { icon: '⭐', label: 'Feedback', href: '/dashboard/teacher/feedback' },
            { icon: '📢', label: 'Grievances', href: '/dashboard/teacher/grievances', active: true },
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">My Grievances 📢</h1>
            <p className="text-white/60">Submit and track your complaints</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary">+ New Grievance</button>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-6 w-full max-w-lg">
              <h2 className="text-lg font-semibold mb-4">Submit Grievance</h2>
              <div className="space-y-3">
                <input className="input-glass w-full" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <textarea className="input-glass w-full h-28 resize-none" placeholder="Describe your grievance…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <select className="input-glass" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="administrative">Administrative</option>
                    <option value="facilities">Facilities</option>
                    <option value="workload">Workload</option>
                    <option value="other">Other</option>
                  </select>
                  <select className="input-glass" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowForm(false)} className="flex-1 glass py-2 rounded-xl text-white/70 hover:bg-white/10">Cancel</button>
                <button onClick={handleSubmit} disabled={saving || !form.title || !form.description} className="flex-1 btn-primary disabled:opacity-50">
                  {saving ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-6 w-full max-w-lg">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <span className={`px-3 py-1 rounded-full text-xs ${STATUS_COLOR[selected.status] ?? ''}`}>{selected.status.replace('_', ' ')}</span>
              </div>
              <p className="text-white/70 mb-4">{selected.description}</p>
              {selected.adminNote && (
                <div className="glass rounded-xl p-4 mb-4">
                  <p className="text-xs text-white/40 mb-1">Admin response</p>
                  <p className="text-white/80">{selected.adminNote}</p>
                </div>
              )}
              <button onClick={() => setSelected(null)} className="btn-primary w-full">Close</button>
            </div>
          </div>
        )}

        {grievances.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-white/40">No grievances submitted yet.</div>
        ) : (
          <div className="glass rounded-xl overflow-hidden">
            {grievances.map((g, i) => (
              <button key={g.id} onClick={() => setSelected(g)}
                className={`w-full text-left flex items-start gap-4 p-4 hover:bg-white/5 transition ${i !== grievances.length - 1 ? 'border-b border-white/10' : ''}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{g.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[g.status] ?? ''}`}>{g.status.replace('_',' ')}</span>
                  </div>
                  <p className="text-white/50 text-sm line-clamp-1">{g.description}</p>
                  <p className="text-white/30 text-xs mt-1">{new Date(g.createdAt).toLocaleDateString()}</p>
                </div>
                {g.adminNote && <span className="text-emerald-400 text-xs flex-shrink-0">Response ✓</span>}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
