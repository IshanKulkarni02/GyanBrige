'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Exam { id: string; courseId: string; courseName: string; courseIcon: string; title: string; status: string; duration: number; totalMarks: number; questionCount: number; createdAt: string; }
interface Course { id: string; name: string; icon: string; }

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-white/10 text-white/50',
  active: 'bg-emerald-500/20 text-emerald-400',
  closed: 'bg-white/5 text-white/30',
};

export default function TeacherExams() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courseId: '', title: '', description: '', duration: 60, totalMarks: 100 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'teacher') { router.push('/login'); return; }
    setUser(parsed);
    load(parsed.id);
  }, [router]);

  const load = async (teacherId: string) => {
    const [examsRes, coursesRes] = await Promise.all([
      authFetch('/api/exams').then(r => r.json()),
      authFetch(`/api/courses?teacherId=${teacherId}`).then(r => r.json()),
    ]);
    setExams(examsRes.exams ?? []);
    setCourses(coursesRes.courses ?? []);
  };

  const handleCreate = async () => {
    if (!form.courseId || !form.title) return;
    setSaving(true);
    const res = await authFetch('/api/exams', { method: 'POST', body: JSON.stringify({ ...form, status: 'draft' }) });
    const { exam } = await res.json();
    setSaving(false);
    setShowForm(false);
    setForm({ courseId: '', title: '', description: '', duration: 60, totalMarks: 100 });
    router.push(`/dashboard/teacher/exams/${exam.id}`);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await authFetch(`/api/exams/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    const stored = localStorage.getItem('user');
    if (stored) { const u = JSON.parse(stored); load(u.id); }
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📝</div></div>;

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
            { icon: '📝', label: 'Exams', href: '/dashboard/teacher/exams', active: true },
            { icon: '⭐', label: 'Feedback', href: '/dashboard/teacher/feedback' },
            { icon: '📢', label: 'Grievances', href: '/dashboard/teacher/grievances' },
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
            <h1 className="text-2xl font-bold">Exams 📝</h1>
            <p className="text-white/60">Create and manage written exams</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary">+ Create Exam</button>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Create New Exam</h2>
              <div className="space-y-3">
                <select className="input-glass w-full" value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}>
                  <option value="">Select course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <input className="input-glass w-full" placeholder="Exam title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <textarea className="input-glass w-full h-20 resize-none" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Duration (min)</label>
                    <input className="input-glass w-full" type="number" min={5} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Total Marks</label>
                    <input className="input-glass w-full" type="number" min={1} value={form.totalMarks} onChange={e => setForm(f => ({ ...f, totalMarks: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowForm(false)} className="flex-1 glass py-2 rounded-xl text-white/70 hover:bg-white/10">Cancel</button>
                <button onClick={handleCreate} disabled={saving || !form.courseId || !form.title} className="flex-1 btn-primary disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create & Add Questions'}
                </button>
              </div>
            </div>
          </div>
        )}

        {exams.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-white/40">No exams yet. Create one to get started.</div>
        ) : (
          <div className="space-y-3">
            {exams.map(e => (
              <div key={e.id} className="glass rounded-xl p-5 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold">{e.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[e.status] ?? ''}`}>{e.status}</span>
                  </div>
                  <p className="text-white/40 text-sm">{e.courseIcon} {e.courseName} · {e.questionCount} questions · {e.duration} min · {e.totalMarks} marks</p>
                </div>
                <div className="flex items-center gap-2">
                  {e.status === 'draft' && (
                    <button onClick={() => handleStatusChange(e.id, 'active')} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition">
                      Publish
                    </button>
                  )}
                  {e.status === 'active' && (
                    <button onClick={() => handleStatusChange(e.id, 'closed')} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">
                      Close
                    </button>
                  )}
                  <Link href={`/dashboard/teacher/exams/${e.id}`} className="text-xs px-3 py-1.5 rounded-lg glass hover:bg-white/10 transition">
                    {e.status === 'draft' ? 'Edit' : 'View / Mark'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
