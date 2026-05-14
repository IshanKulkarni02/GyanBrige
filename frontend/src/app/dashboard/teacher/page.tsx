'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const classes = [
  { id: '1', name: 'Class 10-A', subject: 'Mathematics', students: 32, lastLecture: 'Today' },
  { id: '2', name: 'Class 10-B', subject: 'Mathematics', students: 28, lastLecture: 'Yesterday' },
  { id: '3', name: 'Class 11-A', subject: 'Physics', students: 35, lastLecture: '2 days ago' },
];

const recentUploads = [
  { id: '1', title: 'Calculus - Integration', status: 'processed', views: 45 },
  { id: '2', title: 'Trigonometry Basics', status: 'processing', views: 0 },
  { id: '3', title: 'Algebra Review', status: 'processed', views: 128 },
];

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'teacher') {
        router.push('/login');
      } else {
        setUser(parsed);
        setLoading(false);
      }
    } else {
      router.push('/login');
    }
  }, [router]);

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
            { icon: '📊', label: 'Analytics', href: '#' },
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Students', value: '95', icon: '🎓', color: 'from-emerald-500 to-teal-500' },
            { label: 'Lectures Uploaded', value: '24', icon: '📤', color: 'from-purple-500 to-indigo-500' },
            { label: 'Total Views', value: '1.2K', icon: '👁️', color: 'from-amber-500 to-orange-500' },
            { label: 'Avg Attendance', value: '87%', icon: '📋', color: 'from-blue-500 to-cyan-500' },
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

        {/* Classes & Uploads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Classes */}
          <div>
            <h2 className="text-xl font-semibold mb-4">My Classes</h2>
            <div className="glass rounded-xl overflow-hidden">
              {classes.map((cls, i) => (
                <div
                  key={cls.id}
                  className={`flex items-center gap-4 p-4 hover:bg-white/5 transition cursor-pointer ${
                    i !== classes.length - 1 ? 'border-b border-white/10' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-emerald-400">🏫</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{cls.name}</h4>
                    <p className="text-white/50 text-sm">{cls.subject} • {cls.students} students</p>
                  </div>
                  <span className="text-white/40 text-sm">{cls.lastLecture}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Uploads */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Uploads</h2>
            <div className="glass rounded-xl overflow-hidden">
              {recentUploads.map((upload, i) => (
                <div
                  key={upload.id}
                  className={`flex items-center gap-4 p-4 ${
                    i !== recentUploads.length - 1 ? 'border-b border-white/10' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <span className="text-purple-400">🎬</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{upload.title}</h4>
                    <p className="text-white/50 text-sm">{upload.views} views</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    upload.status === 'processed' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {upload.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
