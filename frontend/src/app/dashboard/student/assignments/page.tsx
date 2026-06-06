'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Assignment {
  id: string; courseId: string; courseName: string; courseIcon: string;
  title: string; description: string; dueDate?: string;
  totalMarks: number; status: string; createdAt: string;
}
interface MySubmission {
  id: string; status: string; marksAwarded?: number; feedback: string; submittedAt: string;
}

const NAV = [
  { icon: '🏠', label: 'Dashboard',   href: '/dashboard/student' },
  { icon: '📚', label: 'My Courses',  href: '/dashboard/student/courses' },
  { icon: '📊', label: 'Attendance',  href: '/dashboard/student/attendance' },
  { icon: '📅', label: 'Timetable',   href: '/dashboard/student/timetable' },
  { icon: '📝', label: 'Exams',       href: '/dashboard/student/exams' },
  { icon: '📌', label: 'Assignments', href: '/dashboard/student/assignments', active: true },
  { icon: '⭐', label: 'Feedback',    href: '/dashboard/student/feedback' },
  { icon: '📢', label: 'Grievances',  href: '/dashboard/student/grievances' },
];

export default function StudentAssignments() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [list, setList] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, MySubmission | null>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'student') { router.push('/login'); return; }
    setUser(parsed);
    load();
  }, [router]);

  const load = async () => {
    const res = await authFetch('/api/assignments').then(r => r.json());
    const assignments: Assignment[] = res.assignments ?? [];
    setList(assignments);

    const subMap: Record<string, MySubmission | null> = {};
    await Promise.all(
      assignments.map(async a => {
        const sRes = await authFetch(`/api/assignments/${a.id}/submissions`).then(r => r.json());
        subMap[a.id] = sRes.submission ?? null;
      })
    );
    setSubmissions(subMap);
  };

  const handleExpand = (id: string) => {
    setExpanded(prev => prev === id ? null : id);
    setText('');
  };

  const handleSubmit = async (assignmentId: string) => {
    if (!text.trim()) return;
    setSubmitting(true);
    await authFetch(`/api/assignments/${assignmentId}/submissions`, {
      method: 'POST',
      body: JSON.stringify({ content: text }),
    });
    setSubmitting(false);
    setExpanded(null);
    setText('');
    load();
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📌</div></div>;

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-6 hidden lg:block">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="text-2xl">📚</span><span className="text-xl font-bold gradient-text">GyanBrige</span>
        </Link>
        <nav className="space-y-2">
          {NAV.map(item => (
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Assignments 📌</h1>
          <p className="text-white/60">Submit your assignments and check your grades</p>
        </div>

        {list.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-white/40">
            No active assignments right now.
          </div>
        ) : (
          <div className="space-y-4">
            {list.map(a => {
              const sub = submissions[a.id];
              const isOpen = expanded === a.id;
              const overdue = a.dueDate && new Date(a.dueDate) < new Date() && !sub;

              return (
                <div key={a.id} className="glass rounded-xl overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold">{a.title}</span>
                          {sub ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              sub.status === 'graded' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>{sub.status}</span>
                          ) : overdue ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">overdue</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/50">pending</span>
                          )}
                        </div>
                        <p className="text-white/40 text-sm">
                          {a.courseIcon} {a.courseName}
                          {a.dueDate ? ` · Due ${new Date(a.dueDate).toLocaleDateString()}` : ''}
                          {` · ${a.totalMarks} marks`}
                        </p>
                        {a.description && (
                          <p className="mt-2 text-white/60 text-sm">{a.description}</p>
                        )}
                      </div>

                      {sub?.status === 'graded' ? (
                        <div className="text-right shrink-0">
                          <span className="text-lg font-bold text-emerald-400">{sub.marksAwarded}/{a.totalMarks}</span>
                          <p className="text-white/40 text-xs">marks</p>
                        </div>
                      ) : !sub ? (
                        <button onClick={() => handleExpand(a.id)}
                          className="btn-primary text-sm shrink-0">
                          {isOpen ? 'Cancel' : 'Submit'}
                        </button>
                      ) : (
                        <button onClick={() => handleExpand(a.id)}
                          className="text-xs px-3 py-1.5 rounded-lg glass hover:bg-white/10 transition shrink-0">
                          {isOpen ? 'Cancel' : 'Re-submit'}
                        </button>
                      )}
                    </div>

                    {sub && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-white/40 text-xs mb-1">Your submission · {new Date(sub.submittedAt).toLocaleString()}</p>
                        {sub.status === 'graded' && sub.feedback && (
                          <p className="text-white/60 text-sm italic">"{sub.feedback}"</p>
                        )}
                      </div>
                    )}
                  </div>

                  {isOpen && (
                    <div className="border-t border-white/10 p-5">
                      <label className="text-white/40 text-xs mb-2 block">Your answer / response</label>
                      <textarea
                        className="input-glass w-full h-32 resize-none mb-3"
                        placeholder="Write your answer here…"
                        value={text}
                        onChange={e => setText(e.target.value)}
                      />
                      <button onClick={() => handleSubmit(a.id)} disabled={submitting || !text.trim()}
                        className="btn-primary disabled:opacity-50">
                        {submitting ? 'Submitting…' : 'Submit Assignment'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
