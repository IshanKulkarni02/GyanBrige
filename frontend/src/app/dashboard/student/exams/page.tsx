'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Exam {
  id: string; courseId: string; courseName: string; courseIcon: string;
  title: string; status: string; duration: number; totalMarks: number; questionCount: number;
}

export default function StudentExams() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'student') { router.push('/login'); return; }
    setUser(parsed);
    authFetch('/api/exams').then(r => r.json()).then(d => setExams(d.exams ?? []));
  }, [router]);

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📝</div></div>;

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
            { icon: '📝', label: 'Exams', href: '/dashboard/student/exams', active: true },
            { icon: '⭐', label: 'Feedback', href: '/dashboard/student/feedback' },
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Exams 📝</h1>
          <p className="text-white/60">Written exams for your courses</p>
        </div>

        {exams.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-white/40">
            No exams scheduled yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map(e => (
              <Link key={e.id} href={`/dashboard/student/exams/${e.id}`} className="glass glass-hover rounded-xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">📝</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{e.title}</h3>
                    <p className="text-white/40 text-sm">{e.courseIcon} {e.courseName}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-white/50">
                  <span>⏱ {e.duration} min</span>
                  <span>📊 {e.totalMarks} marks</span>
                  <span>❓ {e.questionCount} questions</span>
                </div>
                <div className="mt-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">Active — Take Exam →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
