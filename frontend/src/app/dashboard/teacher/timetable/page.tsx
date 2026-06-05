'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday'] as const;
type Day = typeof DAYS[number];

interface TimetableEntry {
  id: string; courseId: string; day: Day; startTime: string; endTime: string; room: string;
  courseName: string; courseIcon: string; courseColor: string;
}

export default function TeacherTimetable() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'teacher') { router.push('/login'); return; }
    setUser(parsed);
    authFetch(`/api/timetable?teacherId=${parsed.id}`)
      .then(r => r.json()).then(d => setEntries(d.entries ?? []));
  }, [router]);

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
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/teacher' },
            { icon: '📤', label: 'Upload Lecture', href: '/dashboard/teacher/upload' },
            { icon: '📋', label: 'Attendance', href: '/dashboard/teacher/attendance' },
            { icon: '🎙️', label: 'Record', href: '/dashboard/teacher/record' },
            { icon: '📅', label: 'Timetable', href: '/dashboard/teacher/timetable', active: true },
            { icon: '📝', label: 'Exams', href: '/dashboard/teacher/exams' },
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold">My Timetable 📅</h1>
          <p className="text-white/60">Your weekly teaching schedule</p>
        </div>

        <div className="space-y-6">
          {DAYS.map(day => (
            <div key={day}>
              <h2 className="text-base font-semibold mb-3 capitalize text-white/80">{day}</h2>
              {byDay[day].length === 0 ? (
                <div className="glass rounded-xl p-4 text-white/30 text-sm">No classes</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {byDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(e => (
                    <div key={e.id} className={`glass rounded-xl p-4 flex items-start gap-3 border-l-4 border-emerald-500/60`}>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${e.courseColor || 'from-emerald-500 to-teal-500'} flex items-center justify-center flex-shrink-0`}>
                        <span>{e.courseIcon}</span>
                      </div>
                      <div>
                        <p className="font-medium">{e.courseName}</p>
                        <p className="text-emerald-400 text-sm">{e.startTime} – {e.endTime}</p>
                        {e.room && <p className="text-white/40 text-xs">📍 {e.room}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {entries.length === 0 && (
            <div className="glass rounded-xl p-8 text-center text-white/40">
              No timetable slots assigned yet. Ask an admin to set up your schedule.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
