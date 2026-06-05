'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Course     { id: string; name: string; icon: string; color: string; }
interface Policy     { minAttendancePercent: number; remoteAllowPercent: number; }
interface Summary    { total: number; present: number; remote: number; percentage: number; }
interface Session    { id: string; date: string; title: string; type: string; status: string; methods: string[]; }
interface CheckinRow { sessionId: string; method: string; status: string; checkedInAt: string; }

interface CourseAttendance {
  course: Course;
  policy: Policy;
  summary: Summary;
  sessions: Session[];
  checkins: CheckinRow[];
}

export default function StudentAttendancePage() {
  const router = useRouter();
  const [data,    setData]    = useState<CourseAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let u;
    try { u = JSON.parse(stored); } catch { localStorage.removeItem('user'); router.push('/login'); return; }
    if (u.role !== 'student') { router.push('/login'); return; }
    load(u.id);
  }, [router]);

  const load = async (userId: string) => {
    try {
      const er = await authFetch(`/api/enrollments?userId=${userId}`);
      const ed = await er.json();
      const enrollments = ed.enrollments ?? [];

      const results = await Promise.all(enrollments.map(async (e: { courseId: string; course?: Course }) => {
        const cid = e.courseId;
        const [sr, pr] = await Promise.all([
          authFetch(`/api/attendance/sessions?courseId=${cid}`).then(r => r.json()).catch(() => ({ sessions: [] })),
          authFetch(`/api/attendance/policy?courseId=${cid}`).then(r => r.json()).catch(() => ({ policy: null })),
        ]);
        const sessions: Session[] = sr.sessions ?? [];
        const endedIds = sessions.filter((s: Session) => s.status === 'ended').map((s: Session) => s.id);

        // Fetch checkins from ended sessions
        const checkins: CheckinRow[] = [];
        await Promise.all(endedIds.map(async (sid: string) => {
          const r = await authFetch(`/api/attendance/sessions/${sid}`).then(r => r.json()).catch(() => null);
          if (r?.checkins) {
            const mine = r.checkins.filter((c: { studentId: string }) => c.studentId === userId);
            checkins.push(...mine.map((c: CheckinRow) => ({ ...c, sessionId: sid })));
          }
        }));

        const total   = endedIds.length;
        const present = checkins.filter(c => c.status === 'present' || c.status === 'late').length;
        const remote  = checkins.filter(c => c.status === 'remote').length;
        const pct     = total > 0 ? Math.round(((present + remote) / total) * 100) : 0;

        return {
          course:  e.course ?? { id: cid, name: cid, icon: '📚', color: 'from-emerald-500 to-teal-500' },
          policy:  pr.policy ?? { minAttendancePercent: 75, remoteAllowPercent: 30 },
          summary: { total, present, remote, percentage: pct },
          sessions,
          checkins,
        };
      }));

      setData(results);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4 animate-pulse">📊</div><p className="text-white/60">Loading…</p></div>
    </div>
  );

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <Link href="/dashboard/student" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">← Dashboard</Link>
      <h1 className="text-3xl font-bold mb-2">📊 My Attendance</h1>
      <p className="text-white/50 text-sm mb-8">Track your attendance across all enrolled courses</p>

      {data.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center text-white/40">
          <p className="text-4xl mb-3">📚</p><p>You are not enrolled in any courses yet.</p>
        </div>
      )}

      <div className="space-y-6">
        {data.map(({ course, policy, summary, sessions, checkins }) => {
          const ok    = summary.percentage >= policy.minAttendancePercent;
          const warn  = summary.percentage >= policy.minAttendancePercent - 10 && !ok;
          const color = ok ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-red-400';
          const bar   = ok ? 'bg-emerald-500' : warn ? 'bg-amber-500' : 'bg-red-500';
          const endedSessions = sessions.filter(s => s.status === 'ended');

          return (
            <div key={course.id} className="glass rounded-2xl overflow-hidden">
              {/* Course header */}
              <div className={`h-1 bg-gradient-to-r ${course.color}`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{course.icon}</span>
                    <div>
                      <p className="font-semibold">{course.name}</p>
                      <p className="text-xs text-white/40">{summary.total} sessions recorded</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${color}`}>{summary.percentage}%</p>
                    <p className="text-xs text-white/40">Required: {policy.minAttendancePercent}%</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-1">
                  <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${Math.min(summary.percentage, 100)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-white/30 mb-4">
                  <span>0%</span>
                  <span className={`font-medium ${color}`}>
                    {ok ? '✓ Sufficient' : warn ? '⚠️ At risk' : '✗ Below minimum'}
                  </span>
                  <span>100%</span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    ['Present',  summary.present,                           'text-emerald-400'],
                    ['Remote',   summary.remote,                            'text-blue-400'   ],
                    ['Absent',   summary.total - summary.present - summary.remote, 'text-red-400'],
                    ['Total',    summary.total,                             'text-white/60'   ],
                  ].map(([l, v, c]) => (
                    <div key={l as string} className="bg-white/5 rounded-xl p-2.5 text-center">
                      <p className={`text-lg font-bold ${c}`}>{v}</p>
                      <p className="text-xs text-white/40">{l}</p>
                    </div>
                  ))}
                </div>

                {/* Session history */}
                {endedSessions.length > 0 && (
                  <details className="group">
                    <summary className="text-xs text-white/40 cursor-pointer hover:text-white/70 transition select-none">
                      View session history ({endedSessions.length} sessions) ▸
                    </summary>
                    <div className="mt-3 space-y-1">
                      {endedSessions.slice(0, 10).map(s => {
                        const c = checkins.find(c => c.sessionId === s.id);
                        const statusColor = !c ? 'text-red-400' : c.status === 'present' || c.status === 'late' ? 'text-emerald-400' : c.status === 'remote' ? 'text-blue-400' : 'text-red-400';
                        const statusIcon  = !c ? '✗' : c.status === 'present' ? '✓' : c.status === 'late' ? '⏰' : c.status === 'remote' ? '🌐' : '✗';
                        const methodIcon  = c?.method === 'qr' ? '📲' : c?.method === 'network' ? '📡' : c?.method === 'online' ? '🌐' : c?.method === 'manual' ? '✏️' : '';
                        return (
                          <div key={s.id} className="flex items-center gap-3 py-2 border-t border-white/5">
                            <span className={`text-sm font-bold w-5 shrink-0 ${statusColor}`}>{statusIcon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white/70 truncate">{s.title}</p>
                              <p className="text-xs text-white/30">{s.date} {s.type === 'online' ? '· 🌐 Online' : ''}</p>
                            </div>
                            {c && <span className="text-xs text-white/30">{methodIcon} {new Date(c.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
