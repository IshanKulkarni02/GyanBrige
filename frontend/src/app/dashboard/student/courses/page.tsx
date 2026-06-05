'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Lecture { id: string; title: string; duration: number; order: number; }
interface CourseWithProgress {
  id: string; name: string; description: string; icon: string; color: string;
  teacherName: string; lectureCount: number; progress: number;
  completedLectures: string[];
  enrolled?: boolean;
}
interface UserData { id: string; name: string; role: string; }

export default function MyCoursesPage() {
  const router = useRouter();
  const [user, setUser]           = useState<UserData | null>(null);
  const [courses, setCourses]     = useState<CourseWithProgress[]>([]);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [lectures, setLectures]   = useState<Record<string, Lecture[]>>({});
  const [loading, setLoading]     = useState(true);
  const [loadingLec, setLoadingLec] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch {
      localStorage.removeItem('user');
      router.push('/login'); return;
    }
    if (parsed.role !== 'student') { router.push('/login'); return; }
    setUser(parsed);
    loadEnrolled(parsed.id);
  }, [router]);

  const loadEnrolled = async (userId: string) => {
    try {
      const [coursesRes, enrollmentsRes] = await Promise.all([
        authFetch(`/api/courses?userId=${userId}`),
        authFetch(`/api/enrollments?userId=${userId}`),
      ]);
      const { courses: allCourses } = await coursesRes.json();
      const { enrollments }        = await enrollmentsRes.json();

      const enrolled: CourseWithProgress[] = (allCourses ?? [])
        .filter((c: CourseWithProgress) => c.enrolled)
        .map((c: CourseWithProgress) => {
          const enr = (enrollments ?? []).find((e: { courseId: string; completedLectures: string[] }) => e.courseId === c.id);
          return { ...c, completedLectures: enr?.completedLectures ?? [] };
        });

      setCourses(enrolled);
    } catch { /* silently fail */ }
    finally  { setLoading(false); }
  };

  const toggleCourse = async (courseId: string) => {
    if (expanded === courseId) { setExpanded(null); return; }
    setExpanded(courseId);
    if (lectures[courseId]) return;         // already loaded
    setLoadingLec(courseId);
    try {
      const res  = await authFetch(`/api/lectures?courseId=${courseId}`);
      const data = await res.json();
      setLectures(prev => ({ ...prev, [courseId]: data.lectures ?? [] }));
    } catch { /* ignore */ }
    finally  { setLoadingLec(null); }
  };

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4 animate-pulse">📚</div><p className="text-white/60">Loading...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-6 hidden lg:block">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="text-2xl">📚</span>
          <span className="text-xl font-bold gradient-text">GyanBrige</span>
        </Link>
        <nav className="space-y-2">
          {[
            { icon: '🏠', label: 'Dashboard',  href: '/dashboard/student' },
            { icon: '📚', label: 'My Courses', href: '/dashboard/student/courses', active: true },
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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">📚 My Courses</h1>
            <p className="text-white/60">{courses.length} course{courses.length !== 1 ? 's' : ''} enrolled</p>
          </div>
          <Link href="/dashboard/student" className="glass px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition text-sm">
            ← Dashboard
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <span className="text-5xl block mb-4">📭</span>
            <h3 className="text-xl font-semibold mb-2">No courses yet</h3>
            <p className="text-white/50 mb-6">Go to the dashboard and enrol in a course to get started.</p>
            <Link href="/dashboard/student" className="btn-primary px-6 py-3">Browse Courses</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map(course => {
              const isOpen    = expanded === course.id;
              const lecs      = lectures[course.id] ?? [];
              const isLoading = loadingLec === course.id;
              const done      = course.completedLectures.length;
              const total     = course.lectureCount;

              return (
                <div key={course.id} className="glass rounded-2xl overflow-hidden">
                  {/* Course header row */}
                  <button onClick={() => toggleCourse(course.id)}
                    className="w-full flex items-center gap-4 p-5 hover:bg-white/5 transition text-left">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${course.color} flex items-center justify-center shrink-0`}>
                      <span className="text-2xl">{course.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold">{course.name}</h3>
                      <p className="text-white/50 text-sm truncate">{course.description}</p>
                      <p className="text-white/40 text-xs mt-0.5">by {course.teacherName}</p>
                    </div>
                    {/* Progress */}
                    <div className="text-right shrink-0 mr-2">
                      <span className={`text-xl font-bold ${course.progress === 100 ? 'text-emerald-400' : 'text-white'}`}>
                        {course.progress}%
                      </span>
                      <p className="text-white/40 text-xs">{done}/{total} lectures</p>
                    </div>
                    <span className={`text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>

                  {/* Progress bar */}
                  <div className="px-5 pb-1">
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${course.color} transition-all`} style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>

                  {/* Lecture list (expanded) */}
                  {isOpen && (
                    <div className="border-t border-white/10 mt-3">
                      {isLoading ? (
                        <div className="p-6 text-center text-white/40 text-sm animate-pulse">Loading lectures…</div>
                      ) : lecs.length === 0 ? (
                        <div className="p-6 text-center text-white/40 text-sm">No lectures yet</div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {lecs.map((lec, i) => {
                            const isDone = course.completedLectures.includes(lec.id);
                            return (
                              <Link key={lec.id} href={`/dashboard/student/lecture/${lec.id}`}
                                className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${isDone ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50'}`}>
                                  {isDone ? '✓' : i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${isDone ? 'text-white/60' : 'text-white/90'}`}>{lec.title}</p>
                                  <p className="text-xs text-white/40">{lec.duration} min</p>
                                </div>
                                <span className="text-white/30 text-xs shrink-0">▶ Watch</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                      <div className="p-4">
                        <Link href={`/dashboard/student/course/${course.id}`}
                          className="block text-center text-sm text-emerald-400 hover:text-emerald-300 transition">
                          View full course →
                        </Link>
                      </div>
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
