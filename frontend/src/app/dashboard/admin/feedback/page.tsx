'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Feedback {
  id: string; courseId: string; courseName: string; courseIcon: string;
  teacherName: string; subjectRating: number; teacherRating: number;
  comment: string; studentName: string; anonymous: boolean; createdAt: string;
}

function Stars({ value }: { value: number }) {
  return <span className="text-amber-400">{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>;
}

export default function AdminFeedback() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'admin') { router.push('/login'); return; }
    setUser(parsed);
    authFetch('/api/feedback').then(r => r.json()).then(d => setFeedback(d.feedback ?? []));
  }, [router]);

  const courses = [...new Set(feedback.map(f => f.courseId))].map(id => {
    const f = feedback.find(x => x.courseId === id)!;
    return { id, name: f.courseName, icon: f.courseIcon };
  });

  const filtered = filter === 'all' ? feedback : feedback.filter(f => f.courseId === filter);
  const avgSubject = filtered.length ? (filtered.reduce((s, f) => s + f.subjectRating, 0) / filtered.length).toFixed(1) : '—';
  const avgTeacher = filtered.length ? (filtered.reduce((s, f) => s + f.teacherRating, 0) / filtered.length).toFixed(1) : '—';

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">⭐</div></div>;

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
            { icon: '📢', label: 'Grievances', href: '/dashboard/admin/grievances' },
            { icon: '⭐', label: 'Feedback', href: '/dashboard/admin/feedback', active: true },
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold">All Feedback ⭐</h1>
          <p className="text-white/60">Subject and teacher ratings across all courses</p>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-xl text-sm transition ${filter === 'all' ? 'bg-emerald-500/20 text-emerald-400' : 'glass text-white/60 hover:bg-white/10'}`}>All</button>
          {courses.map(c => (
            <button key={c.id} onClick={() => setFilter(c.id)} className={`px-3 py-1.5 rounded-xl text-sm transition ${filter === c.id ? 'bg-emerald-500/20 text-emerald-400' : 'glass text-white/60 hover:bg-white/10'}`}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Responses', value: filtered.length, icon: '📊', color: 'from-emerald-500 to-teal-500' },
            { label: 'Avg Subject', value: `${avgSubject}/5`, icon: '📚', color: 'from-amber-500 to-orange-500' },
            { label: 'Avg Teacher', value: `${avgTeacher}/5`, icon: '👨‍🏫', color: 'from-purple-500 to-indigo-500' },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-5">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
                <span>{s.icon}</span>
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-white/50 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-white/40">No feedback yet.</div>
        ) : (
          <div className="glass rounded-xl overflow-hidden">
            {filtered.map((f, i) => (
              <div key={f.id} className={`p-4 ${i !== filtered.length - 1 ? 'border-b border-white/10' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-medium">{f.courseIcon} {f.courseName}</span>
                    <span className="text-white/40 text-sm ml-2">· {f.teacherName}</span>
                  </div>
                  <span className="text-white/30 text-xs">{f.anonymous ? 'Anonymous' : f.studentName} · {new Date(f.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-6">
                  <span className="text-sm text-white/60">Subject: <Stars value={f.subjectRating} /></span>
                  <span className="text-sm text-white/60">Teacher: <Stars value={f.teacherRating} /></span>
                </div>
                {f.comment && <p className="text-white/50 text-sm italic mt-1">"{f.comment}"</p>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
