'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { coursesApi, enrollmentsApi, type Course, type Enrollment } from '@/lib/api';

interface UserData {
  id: string;
  name: string;
  role: string;
  email: string;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'student') {
        router.push('/login');
      } else {
        setUser(parsed);
        loadData(parsed.id);
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const loadData = async (userId: string) => {
    try {
      const [coursesRes, enrollmentsRes] = await Promise.all([
        coursesApi.getAll(userId),
        enrollmentsApi.getByUser(userId),
      ]);
      setCourses(coursesRes.courses);
      setEnrollments(enrollmentsRes.enrollments);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  // Get enrolled courses with progress
  const enrolledCourses = courses.filter(c => c.enrolled);
  const totalProgress = enrolledCourses.length > 0 
    ? Math.round(enrolledCourses.reduce((sum, c) => sum + (c.progress || 0), 0) / enrolledCourses.length)
    : 0;

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📚</div>
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
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/student', active: true },
            { icon: '📚', label: 'My Courses', href: '#' },
            { icon: '📝', label: 'Notes', href: '#' },
            { icon: '📊', label: 'Progress', href: '#' },
            { icon: '⚙️', label: 'Settings', href: '#' },
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
            <h1 className="text-2xl font-bold">Welcome back, {user.name.split(' ')[0]}! 👋</h1>
            <p className="text-white/60">Continue your learning journey</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="glass p-3 rounded-xl hover:bg-white/10 transition">
              <span>🔔</span>
            </button>
            <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="text-2xl">🎓</span>
              <span className="text-sm">{user.name}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Courses Enrolled', value: String(enrolledCourses.length), icon: '📚', color: 'from-emerald-500 to-teal-500' },
            { label: 'Total Courses', value: String(courses.length), icon: '🎬', color: 'from-purple-500 to-indigo-500' },
            { label: 'Avg Progress', value: `${totalProgress}%`, icon: '📊', color: 'from-amber-500 to-orange-500' },
            { label: 'Completed', value: String(enrolledCourses.filter(c => c.progress === 100).length), icon: '✅', color: 'from-blue-500 to-cyan-500' },
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

        {/* Courses Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">All Courses</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/student/course/${course.id}`}
                className="glass glass-hover rounded-xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${course.color} flex items-center justify-center`}>
                    <span className="text-2xl">{course.icon}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-white/50 text-sm">{course.lectureCount} lectures</span>
                    {course.enrolled && (
                      <span className="text-emerald-400 text-xs">✓ Enrolled</span>
                    )}
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-1">{course.name}</h3>
                <p className="text-white/50 text-sm mb-3">{course.description}</p>
                {course.enrolled && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${course.color}`}
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-white/70">{course.progress}%</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* My Enrollments */}
        {enrolledCourses.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">My Learning Progress</h2>
            <div className="glass rounded-xl overflow-hidden">
              {enrolledCourses.map((course, i) => (
                <Link
                  key={course.id}
                  href={`/dashboard/student/course/${course.id}`}
                  className={`flex items-center gap-4 p-4 hover:bg-white/5 transition ${
                    i !== enrolledCourses.length - 1 ? 'border-b border-white/10' : ''
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${course.color} flex items-center justify-center`}>
                    <span className="text-xl">{course.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{course.name}</h4>
                    <p className="text-white/50 text-sm">{course.lectureCount} lectures • {course.teacherName}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${course.progress === 100 ? 'text-emerald-400' : 'text-white'}`}>
                      {course.progress}%
                    </span>
                    {course.progress === 100 && <span className="block text-xs text-emerald-400">Complete!</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
