'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  createdAt: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'student' | 'teacher' | 'admin'>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'student' | 'teacher' | 'admin'>('student');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'admin') {
        router.push('/login');
      } else {
        setCurrentUser(parsed);
        loadUsers();
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = filter === 'all' ? users : users.filter(u => u.role === filter);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'student': return '🎓';
      case 'teacher': return '👨‍🏫';
      case 'admin': return '⚙️';
      default: return '👤';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'student': return 'bg-emerald-500/20 text-emerald-400';
      case 'teacher': return 'bg-purple-500/20 text-purple-400';
      case 'admin': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-white/10 text-white/50';
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    try {
      await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, role: editRole }),
      });
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      console.error('Failed to update user:', err);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      loadUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">👥</div>
          <p className="text-white/60">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">
        ← Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">👥 User Management</h1>
          <p className="text-white/60">Manage all users in the system</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users', value: users.length, icon: '👥', color: 'from-emerald-500 to-teal-500' },
          { label: 'Students', value: users.filter(u => u.role === 'student').length, icon: '🎓', color: 'from-blue-500 to-cyan-500' },
          { label: 'Teachers', value: users.filter(u => u.role === 'teacher').length, icon: '👨‍🏫', color: 'from-purple-500 to-indigo-500' },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: '⚙️', color: 'from-amber-500 to-orange-500' },
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

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {(['all', 'student', 'teacher', 'admin'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl transition capitalize ${
              filter === f ? 'bg-emerald-500 text-white' : 'glass hover:bg-white/10'
            }`}
          >
            {f === 'all' ? 'All Users' : f + 's'}
          </button>
        ))}
      </div>

      {/* Users List */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-semibold">{filteredUsers.length} Users</h2>
        </div>
        <div className="divide-y divide-white/10">
          {filteredUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-4 p-4 hover:bg-white/5 transition">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getRoleColor(user.role)}`}>
                <span className="text-xl">{getRoleIcon(user.role)}</span>
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{user.name}</h4>
                <p className="text-white/50 text-sm">{user.email}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs capitalize ${getRoleColor(user.role)}`}>
                {user.role}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(user)}
                  className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteUser(user.id)}
                  className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingUser(null)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-4">Edit User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-glass"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'student' | 'teacher' | 'admin')}
                  className="input-glass"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-4">
                <button onClick={saveEdit} className="btn-primary flex-1 py-3">
                  Save Changes
                </button>
                <button onClick={() => setEditingUser(null)} className="glass px-6 py-3 rounded-xl">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
