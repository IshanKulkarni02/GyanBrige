'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface CourseOption { id: string; name: string; icon: string; color: string; teacherName?: string; alreadySubmitted?: boolean; }
interface Feedback { id: string; courseId: string; courseName: string; courseIcon: string; teacherName: string; subjectRating: number; teacherRating: number; comment: string; createdAt: string; }

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)}
          className={`text-xl transition ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${n <= value ? 'text-amber-400' : 'text-white/20'}`}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function StudentFeedback() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [myFeedback, setMyFeedback] = useState<Feedback[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courseId: '', subjectRating: 4, teacherRating: 4, comment: '', anonymous: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'student') { router.push('/login'); return; }
    setUser(parsed);
    load(parsed.id);
  }, [router]);

  const load = async (userId: string) => {
    const [enrRes, fbRes] = await Promise.all([
      authFetch(`/api/enrollments?userId=${userId}`).then(r => r.json()),
      authFetch('/api/feedback').then(r => r.json()),
    ]);
    const feedback: Feedback[] = fbRes.feedback ?? [];
    setMyFeedback(feedback);
    const submittedCourseIds = new Set(feedback.map(f => f.courseId));
    const enrollments = enrRes.enrollments ?? [];
    const courseList = await Promise.all(
      enrollments.map(async (e: { courseId: string }) => {
        const r = await authFetch(`/api/courses/${e.courseId}`);
        const { course } = await r.json();
        return { id: course.id, name: course.name, icon: course.icon, color: course.color, teacherName: course.teacherName, alreadySubmitted: submittedCourseIds.has(course.id) };
      })
    );
    setCourses(courseList);
  };

  const handleSubmit = async () => {
    if (!form.courseId) { setError('Please select a course'); return; }
    setSaving(true);
    setError('');
    const res = await authFetch('/api/feedback', { method: 'POST', body: JSON.stringify(form) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'Failed to submit'); return; }
    setShowForm(false);
    setForm({ courseId: '', subjectRating: 4, teacherRating: 4, comment: '', anonymous: false });
    const stored = localStorage.getItem('user');
    if (stored) { const u = JSON.parse(stored); load(u.id); }
  };

  const availableCourses = courses.filter(c => !c.alreadySubmitted);

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">⭐</div></div>;

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-6 hidden lg:block">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="text-2xl">📚</span><span className="text-xl font-bold gradient-text">GyanBrige</span>
        </Link>
        <nav className="space-y-2">
          {[
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/student' },
            { icon: '📚', label: 'My Courses', href: '/dashboard/student/courses' },
            { icon: '📊', label: 'Attendance', href: '/dashboard/student/attendance' },
            { icon: '📅', label: 'Timetable', href: '/dashboard/student/timetable' },
            { icon: '📝', label: 'Exams', href: '/dashboard/student/exams' },
            { icon: '⭐', label: 'Feedback', href: '/dashboard/student/feedback', active: true },
            { icon: '📢', label: 'Grievances', href: '/dashboard/student/grievances' },
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
            <h1 className="text-2xl font-bold">Feedback ⭐</h1>
            <p className="text-white/60">Rate your subjects and teachers</p>
          </div>
          {availableCourses.length > 0 && (
            <button onClick={() => setShowForm(true)} className="btn-primary">+ Give Feedback</button>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-6 w-full max-w-lg">
              <h2 className="text-lg font-semibold mb-4">Submit Feedback</h2>
              <div className="space-y-4">
                <select className="input-glass w-full" value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}>
                  <option value="">Select a course</option>
                  {availableCourses.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>

                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-white/60 mb-2">Subject Rating</p>
                  <Stars value={form.subjectRating} onChange={v => setForm(f => ({ ...f, subjectRating: v }))} />
                </div>

                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-white/60 mb-2">Teacher Rating</p>
                  <Stars value={form.teacherRating} onChange={v => setForm(f => ({ ...f, teacherRating: v }))} />
                </div>

                <textarea className="input-glass w-full h-24 resize-none" placeholder="Additional comments (optional)…" value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />

                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => setForm(f => ({ ...f, anonymous: !f.anonymous }))}
                    className={`w-10 h-6 rounded-full transition-colors relative ${form.anonymous ? 'bg-emerald-500' : 'bg-white/20'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.anonymous ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm text-white/70">Submit anonymously</span>
                </label>
              </div>
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowForm(false); setError(''); }} className="flex-1 glass py-2 rounded-xl text-white/70 hover:bg-white/10">Cancel</button>
                <button onClick={handleSubmit} disabled={saving || !form.courseId} className="flex-1 btn-primary disabled:opacity-50">
                  {saving ? 'Submitting…' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          </div>
        )}

        {myFeedback.length === 0 && availableCourses.length === 0 && (
          <div className="glass rounded-xl p-8 text-center text-white/40">
            Enroll in courses to give feedback.
          </div>
        )}

        {availableCourses.length > 0 && !showForm && (
          <div className="glass rounded-xl p-5 mb-6 border border-emerald-500/20">
            <p className="text-white/70">You have <span className="text-emerald-400 font-semibold">{availableCourses.length}</span> course{availableCourses.length > 1 ? 's' : ''} waiting for feedback.</p>
          </div>
        )}

        {myFeedback.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-3">Submitted Feedback</h2>
            <div className="space-y-3">
              {myFeedback.map(f => (
                <div key={f.id} className="glass rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">{f.courseIcon}</span>
                    <div>
                      <p className="font-semibold">{f.courseName}</p>
                      <p className="text-white/40 text-xs">{f.teacherName}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/40 text-xs mb-1">Subject</p>
                      <Stars value={f.subjectRating} />
                    </div>
                    <div>
                      <p className="text-white/40 text-xs mb-1">Teacher</p>
                      <Stars value={f.teacherRating} />
                    </div>
                  </div>
                  {f.comment && <p className="text-white/60 text-sm mt-3 italic">"{f.comment}"</p>}
                  <p className="text-white/20 text-xs mt-2">{new Date(f.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
