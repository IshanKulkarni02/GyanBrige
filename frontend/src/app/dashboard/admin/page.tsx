'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const users = [
  { id: '1', name: 'Arjun Kumar', email: 'student@gyan.com', role: 'student', status: 'active' },
  { id: '2', name: 'Dr. Priya Sharma', email: 'teacher@gyan.com', role: 'teacher', status: 'active' },
  { id: '3', name: 'Meera Patel', email: 'meera@gyan.com', role: 'student', status: 'active' },
  { id: '4', name: 'Prof. Amit Verma', email: 'amit@gyan.com', role: 'teacher', status: 'inactive' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [useLocalAI, setUseLocalAI] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'admin') {
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
          <div className="text-4xl mb-4 animate-pulse">⚙️</div>
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
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/admin', active: true },
            { icon: '👥', label: 'Users', href: '/dashboard/admin/users' },
            { icon: '🏫', label: 'Courses', href: '/dashboard/admin/courses' },
            { icon: '🤖', label: 'AI Settings', href: '/dashboard/admin/ai' },
            { icon: '📊', label: 'Analytics', href: '/dashboard/admin/analytics' },
            { icon: '⚙️', label: 'Settings', href: '/dashboard/admin/settings' },
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
            <h1 className="text-2xl font-bold">Admin Dashboard 🛠️</h1>
            <p className="text-white/60">Manage users, classes, and AI settings</p>
          </div>
          <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <span className="text-sm">{user.name}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: '156', icon: '👥', color: 'from-emerald-500 to-teal-500' },
            { label: 'Teachers', value: '12', icon: '👨‍🏫', color: 'from-purple-500 to-indigo-500' },
            { label: 'Students', value: '142', icon: '🎓', color: 'from-amber-500 to-orange-500' },
            { label: 'Active Classes', value: '8', icon: '🏫', color: 'from-blue-500 to-cyan-500' },
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

        {/* AI Config Card */}
        <div className="glass rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">🤖 AI Configuration</h2>
              <p className="text-white/50 text-sm">Toggle between local and cloud AI</p>
            </div>
            <div className={`px-4 py-2 rounded-full ${useLocalAI ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {useLocalAI ? '🦙 Ollama' : '🤖 ChatGPT'}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
            <div className="flex items-center gap-4">
              <span className="text-2xl">🤖</span>
              <span>ChatGPT (Cloud)</span>
            </div>
            <button
              onClick={() => setUseLocalAI(!useLocalAI)}
              className={`w-14 h-8 rounded-full transition-colors relative ${
                useLocalAI ? 'bg-purple-500' : 'bg-emerald-500'
              }`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                useLocalAI ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
            <div className="flex items-center gap-4">
              <span>Ollama (Local)</span>
              <span className="text-2xl">🦙</span>
            </div>
          </div>
        </div>

        {/* Users & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Users */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Users</h2>
              <span className="text-emerald-400/50 text-sm">View All →</span>
            </div>
            <div className="glass rounded-xl overflow-hidden">
              {users.map((u, i) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-4 p-4 ${
                    i !== users.length - 1 ? 'border-b border-white/10' : ''
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    u.role === 'teacher' ? 'bg-purple-500/20' : 'bg-emerald-500/20'
                  }`}>
                    <span>{u.role === 'teacher' ? '👨‍🏫' : '🎓'}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{u.name}</h4>
                    <p className="text-white/50 text-sm">{u.email}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    u.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/50'
                  }`}>
                    {u.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-4">
              <Link href="/dashboard/admin/users" className="glass glass-hover rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <span className="text-xl">➕</span>
                </div>
                <div>
                  <h3 className="font-semibold">Create User</h3>
                  <p className="text-white/50 text-sm">Add new student or teacher</p>
                </div>
              </Link>
              <Link href="/dashboard/admin/courses" className="glass glass-hover rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                  <span className="text-xl">🔗</span>
                </div>
                <div>
                  <h3 className="font-semibold">Course Management</h3>
                  <p className="text-white/50 text-sm">Manage courses and enrollments</p>
                </div>
              </Link>
              <Link href="/dashboard/admin/ai" className="glass glass-hover rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <span className="text-xl">🤖</span>
                </div>
                <div>
                  <h3 className="font-semibold">AI Model Settings</h3>
                  <p className="text-white/50 text-sm">Toggle between ChatGPT & Ollama</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
