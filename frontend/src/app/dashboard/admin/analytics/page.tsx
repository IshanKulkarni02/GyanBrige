'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    students: 0,
    teachers: 0,
    courses: 0,
    lectures: 0,
    enrollments: 0,
  });

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      let parsed;
    try { parsed = JSON.parse(stored); } catch {
      localStorage.removeItem('user');
      router.push('/login'); return;
    }
      if (parsed.role !== 'admin') {
        router.push('/login');
      } else {
        setUser(parsed);
        loadStats();
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const loadStats = async () => {
    try {
      const [usersRes, coursesRes, enrollmentsRes] = await Promise.all([
        authFetch('/api/users'),
        authFetch('/api/courses'),
        authFetch('/api/enrollments'),
      ]);
      const { users = [] }       = await usersRes.json();
      const { courses = [] }     = await coursesRes.json();
      const { enrollments = [] } = await enrollmentsRes.json().catch(() => ({ enrollments: [] }));

      setStats({
        users:       users.length,
        students:    users.filter((u: { role: string }) => u.role === 'student').length,
        teachers:    users.filter((u: { role: string }) => u.role === 'teacher').length,
        courses:     courses.length,
        lectures:    courses.reduce((s: number, c: { lectureCount?: number }) => s + (c.lectureCount ?? 0), 0),
        enrollments: enrollments.length,
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📊</div>
          <p className="text-white/60">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">
        ← Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📊 Analytics</h1>
        <p className="text-white/60">Platform statistics and insights</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Total Users', value: stats.users, icon: '👥', color: 'from-emerald-500 to-teal-500' },
          { label: 'Students', value: stats.students, icon: '🎓', color: 'from-blue-500 to-cyan-500' },
          { label: 'Teachers', value: stats.teachers, icon: '👨‍🏫', color: 'from-purple-500 to-indigo-500' },
          { label: 'Courses', value: stats.courses, icon: '📚', color: 'from-amber-500 to-orange-500' },
          { label: 'Lectures', value: stats.lectures, icon: '🎬', color: 'from-rose-500 to-pink-500' },
          { label: 'Enrollments', value: stats.enrollments, icon: '✅', color: 'from-green-500 to-emerald-500' },
        ].map((stat, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
              <span>{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-white/60 text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Distribution */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">User Distribution</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Students</span>
                <span>{stats.students} ({stats.users > 0 ? Math.round(stats.students / stats.users * 100) : 0}%)</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                  style={{ width: `${stats.users > 0 ? (stats.students / stats.users * 100) : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Teachers</span>
                <span>{stats.teachers} ({stats.users > 0 ? Math.round(stats.teachers / stats.users * 100) : 0}%)</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                  style={{ width: `${stats.users > 0 ? (stats.teachers / stats.users * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content Stats */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Content Overview</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-400">{stats.courses}</div>
              <div className="text-white/60 text-sm">Courses</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-rose-400">{stats.lectures}</div>
              <div className="text-white/60 text-sm">Lectures</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">{stats.enrollments}</div>
              <div className="text-white/60 text-sm">Enrollments</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">
                {stats.courses > 0 ? (stats.lectures / stats.courses).toFixed(1) : 0}
              </div>
              <div className="text-white/60 text-sm">Avg Lectures/Course</div>
            </div>
          </div>
        </div>

        {/* Derived stats */}
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Platform Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-emerald-400">
                {stats.students > 0 ? Math.round((stats.enrollments / stats.students) * 10) / 10 : 0}
              </div>
              <div className="text-white/60 text-sm">Avg courses per student</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-amber-400">
                {stats.courses > 0 ? Math.round(stats.lectures / stats.courses * 10) / 10 : 0}
              </div>
              <div className="text-white/60 text-sm">Avg lectures per course</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-400">
                {stats.courses > 0 ? Math.round(stats.enrollments / stats.courses * 10) / 10 : 0}
              </div>
              <div className="text-white/60 text-sm">Avg enrollments per course</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
