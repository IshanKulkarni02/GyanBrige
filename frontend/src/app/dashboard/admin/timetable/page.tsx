'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday'] as const;
type Day = typeof DAYS[number];

interface TimetableEntry {
  id: string; courseId: string; teacherId: string; day: Day;
  startTime: string; endTime: string; room: string;
  courseName: string; courseIcon: string; courseColor: string; teacherName: string;
}
interface Course { id: string; name: string; icon: string; color: string; teacherId: string; }
interface Teacher { id: string; name: string; }

export default function AdminTimetable() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courseId: '', teacherId: '', day: 'monday' as Day, startTime: '09:00', endTime: '10:00', room: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'admin') { router.push('/login'); return; }
    setUser(parsed);
    load();
  }, [router]);

  const load = async () => {
    const [ttRes, coursesRes, usersRes] = await Promise.all([
      authFetch('/api/timetable'),
      authFetch('/api/courses'),
      authFetch('/api/users'),
    ]);
    const { entries: tt } = await ttRes.json();
    const { courses: cs } = await coursesRes.json();
    const { users: us } = await usersRes.json();
    setEntries(tt ?? []);
    setCourses(cs ?? []);
    setTeachers((us ?? []).filter((u: { role: string }) => u.role === 'teacher'));
  };

  const handleAdd = async () => {
    if (!form.courseId || !form.teacherId) return;
    setSaving(true);
    await authFetch('/api/timetable', { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    setShowForm(false);
    setForm({ courseId: '', teacherId: '', day: 'monday', startTime: '09:00', endTime: '10:00', room: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    await authFetch(`/api/timetable/${id}`, { method: 'DELETE' });
    load();
  };

  // Auto-fill teacher when course selected
  const handleCourseChange = (courseId: string) => {
    const c = courses.find(c => c.id === courseId);
    setForm(f => ({ ...f, courseId, teacherId: c?.teacherId ?? f.teacherId }));
  };

  const byDay = DAYS.reduce((acc, d) => ({ ...acc, [d]: entries.filter(e => e.day === d) }), {} as Record<Day, TimetableEntry[]>);

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📅</div></div>;

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-6 hidden lg:block">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="text-2xl">📚</span>
          <span className="text-xl font-bold gradient-text">GyanBrige</span>
        </Link>
        <nav className="space-y-2">
          {[
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/admin' },
            { icon: '👥', label: 'Users', href: '/dashboard/admin/users' },
            { icon: '🏫', label: 'Courses', href: '/dashboard/admin/courses' },
            { icon: '📅', label: 'Timetable', href: '/dashboard/admin/timetable', active: true },
            { icon: '📢', label: 'Grievances', href: '/dashboard/admin/grievances' },
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Timetable 📅</h1>
            <p className="text-white/60">Manage the weekly class schedule</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary">+ Add Slot</button>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Add Timetable Slot</h2>
              <div className="space-y-3">
                <select className="input-glass w-full" value={form.courseId} onChange={e => handleCourseChange(e.target.value)}>
                  <option value="">Select course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <select className="input-glass w-full" value={form.teacherId} onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))}>
                  <option value="">Select teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select className="input-glass w-full" value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value as Day }))}>
                  {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input className="input-glass" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                  <input className="input-glass" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
                <input className="input-glass w-full" placeholder="Room / Location" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} />
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowForm(false)} className="flex-1 glass py-2 rounded-xl text-white/70 hover:bg-white/10">Cancel</button>
                <button onClick={handleAdd} disabled={saving || !form.courseId || !form.teacherId} className="flex-1 btn-primary disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {DAYS.map(day => (
            <div key={day}>
              <h2 className="text-base font-semibold mb-3 capitalize text-white/80">{day}</h2>
              {byDay[day].length === 0 ? (
                <div className="glass rounded-xl p-4 text-white/30 text-sm">No classes</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {byDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(e => (
                    <div key={e.id} className="glass rounded-xl p-4 flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${e.courseColor || 'from-emerald-500 to-teal-500'} flex items-center justify-center flex-shrink-0`}>
                        <span>{e.courseIcon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{e.courseName}</p>
                        <p className="text-white/50 text-xs">{e.teacherName}</p>
                        <p className="text-emerald-400 text-xs">{e.startTime} – {e.endTime}{e.room ? ` · ${e.room}` : ''}</p>
                      </div>
                      <button onClick={() => handleDelete(e.id)} className="text-white/20 hover:text-red-400 transition text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
