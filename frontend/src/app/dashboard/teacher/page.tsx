'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface CourseItem { id: string; name: string; description: string; icon: string; color: string; lectureCount: number; }

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [myCourses, setMyCourses] = useState<CourseItem[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalLectures, setTotalLectures] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      let parsed;
    try { parsed = JSON.parse(stored); } catch {
      localStorage.removeItem('user');
      router.push('/login'); return;
    }
      if (parsed.role !== 'teacher') {
        router.push('/login');
      } else {
        setUser(parsed);
        loadData(parsed);
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const loadData = async (me: { id: string; role: string }) => {
    try {
      const [coursesRes, enrollmentsRes] = await Promise.all([
        authFetch(`/api/courses?teacherId=${me.id}`),
        authFetch('/api/enrollments'),
      ]);
      if (!coursesRes.ok) throw new Error(`Courses API error: ${coursesRes.status}`);
      if (!enrollmentsRes.ok) throw new Error(`Enrollments API error: ${enrollmentsRes.status}`);
      const { courses } = await coursesRes.json();
      const enrollData = await enrollmentsRes.json().catch(() => ({ enrollments: [] }));
      const courseList: CourseItem[] = courses ?? [];
      setMyCourses(courseList);
      setTotalLectures(courseList.reduce((s, c) => s + (c.lectureCount ?? 0), 0));
      const courseIds = new Set(courseList.map(c => c.id));
      const studentSet = new Set(
        (enrollData.enrollments ?? [])
          .filter((e: { courseId: string }) => courseIds.has(e.courseId))
          .map((e: { userId: string }) => e.userId)
      );
      setTotalStudents(studentSet.size);
    } catch (e) {
      console.error('Failed to load teacher data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">👨‍🏫</div>
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

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
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/teacher', active: true },
            { icon: '📤', label: 'Upload Lecture', href: '/dashboard/teacher/upload' },
            { icon: '📋', label: 'Attendance', href: '/dashboard/teacher/attendance' },
            { icon: '🎙️', label: 'Record', href: '/dashboard/teacher/record' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                item.active ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="absolute bottom-6 left-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 transition"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {user.name}! 👋</h1>
            <p className="text-white/60">Manage your classes and lectures</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/teacher/upload" className="btn-primary">
              📤 Upload Lecture
            </Link>
            <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="text-2xl">👨‍🏫</span>
              <span className="text-sm">{user.name}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Students', value: String(totalStudents), icon: '🎓', color: 'from-emerald-500 to-teal-500' },
            { label: 'My Courses', value: String(myCourses.length), icon: '🏫', color: 'from-purple-500 to-indigo-500' },
            { label: 'Total Lectures', value: String(totalLectures), icon: '📤', color: 'from-amber-500 to-orange-500' },
          ].map((stat, i) => (
            <div key={i} className="glass rounded-xl p-6">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                <span className="text-xl">{stat.icon}</span>
              </div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-white/60 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/dashboard/teacher/upload" className="glass glass-hover rounded-xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📤</span>
            </div>
            <h3 className="font-semibold mb-1">Upload Lecture</h3>
            <p className="text-white/50 text-sm">Upload video/audio files</p>
          </Link>
          <Link href="/dashboard/teacher/attendance" className="glass glass-hover rounded-xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📋</span>
            </div>
            <h3 className="font-semibold mb-1">Mark Attendance</h3>
            <p className="text-white/50 text-sm">Track student attendance</p>
          </Link>
          <Link href="/dashboard/teacher/record" className="glass glass-hover rounded-xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎙️</span>
            </div>
            <h3 className="font-semibold mb-1">Record Lecture</h3>
            <p className="text-white/50 text-sm">Record new audio lecture</p>
          </Link>
        </div>

        {/* My Courses */}
        <div>
          <h2 className="text-xl font-semibold mb-4">My Courses</h2>
          {myCourses.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-white/50">
              No courses yet. Ask an admin to assign you to a course.
            </div>
          ) : (
            <div className="glass rounded-xl overflow-hidden">
              {myCourses.map((course, i) => (
                <Link
                  key={course.id}
                  href={`/dashboard/teacher/course/${course.id}`}
                  className={`flex items-center gap-4 p-4 hover:bg-white/5 transition ${
                    i !== myCourses.length - 1 ? 'border-b border-white/10' : ''
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${course.color} flex items-center justify-center`}>
                    <span>{course.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{course.name}</h4>
                    <p className="text-white/50 text-sm">{course.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-white/70 text-sm">{course.lectureCount} lectures</span>
                    <p className="text-white/30 text-xs">Manage →</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
