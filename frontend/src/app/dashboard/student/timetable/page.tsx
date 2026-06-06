'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday'] as const;
type Day = typeof DAYS[number];

interface TimetableEntry {
  id: string; courseId: string; day: Day; startTime: string; endTime: string; room: string;
  courseName: string; courseIcon: string; courseColor: string; teacherName: string;
}

const DAY_LABELS: Record<Day, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};

export default function StudentTimetable() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'student') { router.push('/login'); return; }
    setUser(parsed);

    Promise.all([
      authFetch('/api/timetable').then(r => r.json()),
      authFetch(`/api/enrollments?userId=${parsed.id}`).then(r => r.json()),
    ]).then(([ttData, enrData]) => {
      const all: TimetableEntry[] = ttData.entries ?? [];
      const ids = new Set<string>((enrData.enrollments ?? []).map((e: { courseId: string }) => e.courseId));
      setEnrolledCourseIds(ids);
      // Only show courses the student is enrolled in
      setEntries(all.filter(e => ids.has(e.courseId)));
    });
  }, [router]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as Day;
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
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/student' },
            { icon: '📚', label: 'My Courses', href: '/dashboard/student/courses' },
            { icon: '📊', label: 'Attendance', href: '/dashboard/student/attendance' },
            { icon: '📅', label: 'Timetable', href: '/dashboard/student/timetable', active: true },
            { icon: '📝', label: 'Exams', href: '/dashboard/student/exams' },
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
          <h1 className="text-2xl font-bold">My Timetable 📅</h1>
          <p className="text-white/60">Classes from your enrolled courses</p>
        </div>

        {/* Today highlight */}
        {byDay[today]?.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-emerald-400 font-semibold">Today ({DAY_LABELS[today]})</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">{byDay[today].length} classes</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {byDay[today].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(e => (
                <div key={e.id} className="glass rounded-xl p-4 flex items-start gap-3 border border-emerald-500/30">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${e.courseColor || 'from-emerald-500 to-teal-500'} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-xl">{e.courseIcon}</span>
                  </div>
                  <div>
                    <p className="font-semibold">{e.courseName}</p>
                    <p className="text-white/50 text-sm">{e.teacherName}</p>
                    <p className="text-emerald-400 text-sm">{e.startTime} – {e.endTime}{e.room ? ` · ${e.room}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-5">
          {DAYS.filter(d => d !== today || byDay[today].length === 0).map(day => (
            <div key={day}>
              <h2 className="text-sm font-semibold mb-2 text-white/60 uppercase tracking-wider">{DAY_LABELS[day]}</h2>
              {byDay[day].length === 0 ? (
                <div className="glass rounded-xl p-3 text-white/20 text-sm">No classes</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {byDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(e => (
                    <div key={e.id} className="glass rounded-xl p-4 flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${e.courseColor || 'from-emerald-500 to-teal-500'} flex items-center justify-center flex-shrink-0`}>
                        <span>{e.courseIcon}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{e.courseName}</p>
                        <p className="text-white/40 text-xs">{e.teacherName}</p>
                        <p className="text-white/60 text-xs">{e.startTime} – {e.endTime}{e.room ? ` · ${e.room}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {entries.length === 0 && (
            <div className="glass rounded-xl p-8 text-center text-white/40">
              No timetable entries for your courses yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
