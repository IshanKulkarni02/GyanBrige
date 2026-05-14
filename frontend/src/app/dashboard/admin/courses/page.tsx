'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Course {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  teacherId: string;
  teacherName?: string;
  lectureCount?: number;
  studentCount?: number;
}

interface Teacher {
  id: string;
  name: string;
}

export default function CoursesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('📚');
  const [newTeacherId, setNewTeacherId] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'admin') {
        router.push('/login');
      } else {
        setUser(parsed);
        loadCourses();
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const loadCourses = async () => {
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setTeachers(data.users?.filter((u: { role: string }) => u.role === 'teacher') || []);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    }
  };

  useEffect(() => {
    if (user) loadTeachers();
  }, [user]);

  const createCourse = async () => {
    if (!newName || !newTeacherId) return;
    try {
      await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          icon: newIcon,
          color: 'from-emerald-500 to-teal-500',
          teacherId: newTeacherId,
        }),
      });
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewIcon('📚'); setNewTeacherId('');
      loadCourses();
    } catch (err) {
      console.error('Failed to create course:', err);
    }
  };

  const updateCourse = async () => {
    if (!editingCourse) return;
    try {
      await fetch(`/api/courses/${editingCourse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          icon: newIcon,
          teacherId: newTeacherId,
        }),
      });
      setEditingCourse(null);
      loadCourses();
    } catch (err) {
      console.error('Failed to update course:', err);
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!confirm('Delete this course?')) return;
    try {
      await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });
      loadCourses();
    } catch (err) {
      console.error('Failed to delete course:', err);
    }
  };

  const startEdit = (course: Course) => {
    setEditingCourse(course);
    setNewName(course.name);
    setNewDesc(course.description);
    setNewIcon(course.icon);
    setNewTeacherId(course.teacherId || '');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📚</div>
          <p className="text-white/60">Loading courses...</p>
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
          <h1 className="text-3xl font-bold mb-2">📚 Course Management</h1>
          <p className="text-white/60">Manage all courses in the system</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-6 py-3">
          + Create Course
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass rounded-xl p-4">
          <div className="text-3xl font-bold text-emerald-400">{courses.length}</div>
          <div className="text-white/60">Total Courses</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-3xl font-bold text-purple-400">
            {courses.reduce((sum, c) => sum + (c.lectureCount || 0), 0)}
          </div>
          <div className="text-white/60">Total Lectures</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-3xl font-bold text-amber-400">
            {courses.reduce((sum, c) => sum + (c.studentCount || 0), 0)}
          </div>
          <div className="text-white/60">Total Enrollments</div>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => (
          <div key={course.id} className="glass rounded-2xl p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${course.color} flex items-center justify-center`}>
                <span className="text-2xl">{course.icon}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{course.name}</h3>
                <p className="text-white/50 text-sm">{course.teacherName}</p>
              </div>
            </div>
            <p className="text-white/60 text-sm mb-4">{course.description}</p>
            <div className="flex gap-4 text-sm mb-4">
              <span className="text-white/50">📹 {course.lectureCount || 0} lectures</span>
              <span className="text-white/50">👥 {course.studentCount || 0} students</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(course)}
                className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30"
              >
                Edit
              </button>
              <button
                onClick={() => deleteCourse(course.id)}
                className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {(showCreate || editingCourse) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowCreate(false); setEditingCourse(null); }}>
          <div className="glass rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-4">{editingCourse ? 'Edit Course' : 'Create Course'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Course Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-glass"
                  placeholder="e.g., Mathematics"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="input-glass min-h-[80px]"
                  placeholder="Course description..."
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Icon (emoji)</label>
                <input
                  type="text"
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  className="input-glass"
                  placeholder="📚"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Assign Teacher</label>
                <select
                  value={newTeacherId}
                  onChange={(e) => setNewTeacherId(e.target.value)}
                  className="input-glass"
                >
                  <option value="">Select a teacher...</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={editingCourse ? updateCourse : createCourse}
                  className="btn-primary flex-1 py-3"
                >
                  {editingCourse ? 'Save Changes' : 'Create Course'}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setEditingCourse(null); }}
                  className="glass px-6 py-3 rounded-xl"
                >
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
