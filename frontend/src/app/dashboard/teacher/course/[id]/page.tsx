'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authFetch } from '@/lib/api';
import { toast } from 'sonner';

interface Lecture  { id: string; title: string; description: string; duration: number; order: number; videoUrl?: string; notes: string; }
interface Student  { id: string; name: string; email: string; progress: number; completedLectures: string[]; }
interface Course   { id: string; name: string; description: string; icon: string; color: string; }
interface UserData { id: string; name: string; role: string; }

export default function TeacherCoursePage() {
  const router   = useRouter();
  const params   = useParams();
  const courseId = params.id as string;

  const [user,     setUser]     = useState<UserData | null>(null);
  const [course,   setCourse]   = useState<Course   | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<'lectures' | 'students'>('lectures');

  // Delete confirm
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const parsed = JSON.parse(stored);
    if (parsed.role !== 'teacher') { router.push('/login'); return; }
    setUser(parsed);
    loadAll();
  }, [router, courseId]);

  const loadAll = async () => {
    try {
      const [courseRes, lecturesRes, enrollmentsRes] = await Promise.all([
        authFetch(`/api/courses/${courseId}`),
        authFetch(`/api/lectures?courseId=${courseId}`),
        authFetch(`/api/enrollments?courseId=${courseId}`),
      ]);
      const { course }       = await courseRes.json();
      const { lectures }     = await lecturesRes.json();
      const { enrollments }  = await enrollmentsRes.json();

      setCourse(course);
      setLectures(lectures ?? []);
      setStudents((enrollments ?? []).map((e: { userId: string; userName: string; userEmail: string; progress: number; completedLectures: string[] }) => ({
        id: e.userId, name: e.userName, email: e.userEmail,
        progress: e.progress, completedLectures: e.completedLectures,
      })));
    } catch { toast.error('Failed to load course'); }
    finally  { setLoading(false); }
  };

  const deleteLecture = async (id: string) => {
    if (!confirm('Delete this lecture?')) return;
    setDeleting(id);
    try {
      const res = await authFetch(`/api/lectures/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setLectures(prev => prev.filter(l => l.id !== id));
      toast.success('Lecture deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally { setDeleting(null); }
  };

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4 animate-pulse">📚</div><p className="text-white/60">Loading...</p></div>
    </div>
  );

  if (!course) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">❌</div>
        <p className="text-white/60">Course not found</p>
        <Link href="/dashboard/teacher" className="text-emerald-400 mt-4 inline-block">← Dashboard</Link>
      </div>
    </div>
  );

  const avgProgress = students.length
    ? Math.round(students.reduce((s, st) => s + st.progress, 0) / students.length)
    : 0;

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Back */}
      <Link href="/dashboard/teacher" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">
        ← Dashboard
      </Link>

      {/* Course header */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${course.color} flex items-center justify-center text-3xl shrink-0`}>
            {course.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold mb-1">{course.name}</h1>
            <p className="text-white/60">{course.description}</p>
          </div>
          <Link href={`/dashboard/teacher/upload?courseId=${courseId}`} className="btn-primary px-4 py-2 text-sm shrink-0">
            + Add Lecture
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: 'Lectures',  value: lectures.length,  icon: '🎬' },
            { label: 'Students',  value: students.length,  icon: '🎓' },
            { label: 'Avg progress', value: `${avgProgress}%`, icon: '📊' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-white/50 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 mb-6">
        {(['lectures', 'students'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-6 py-3 text-sm font-medium capitalize transition border-b-2 ${tab === t ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-white/40 hover:text-white/70'}`}>
            {t === 'lectures' ? `🎬 Lectures (${lectures.length})` : `🎓 Students (${students.length})`}
          </button>
        ))}
      </div>

      {/* Lectures tab */}
      {tab === 'lectures' && (
        <div>
          {lectures.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <span className="text-4xl block mb-3">🎬</span>
              <p className="text-white/50 mb-4">No lectures yet</p>
              <Link href={`/dashboard/teacher/upload?courseId=${courseId}`} className="btn-primary px-6 py-3">
                Upload First Lecture
              </Link>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              {lectures.map((lec, i) => (
                <div key={lec.id} className={`flex items-center gap-4 p-4 hover:bg-white/5 transition ${i !== lectures.length - 1 ? 'border-b border-white/10' : ''}`}>
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/50 text-sm shrink-0">
                    {lec.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{lec.title}</h4>
                    <p className="text-white/40 text-xs">
                      {lec.duration} min
                      {lec.videoUrl && <span className="ml-2 text-emerald-400">● Video</span>}
                      {lec.notes    && <span className="ml-2 text-purple-400">● Notes</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteLecture(lec.id)}
                    disabled={deleting === lec.id}
                    className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                    title="Delete lecture"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Students tab */}
      {tab === 'students' && (
        <div>
          {students.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <span className="text-4xl block mb-3">🎓</span>
              <p className="text-white/50">No students enrolled yet</p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              {students.map((st, i) => (
                <div key={st.id} className={`flex items-center gap-4 p-4 ${i !== students.length - 1 ? 'border-b border-white/10' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <span>🎓</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{st.name}</p>
                    <p className="text-white/40 text-xs">{st.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${st.progress === 100 ? 'text-emerald-400' : 'text-white'}`}>{st.progress}%</p>
                    <p className="text-white/30 text-xs">{st.completedLectures.length}/{lectures.length} lectures</p>
                  </div>
                  {/* Mini progress bar */}
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                    <div className={`h-full bg-gradient-to-r ${course.color}`} style={{ width: `${st.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
