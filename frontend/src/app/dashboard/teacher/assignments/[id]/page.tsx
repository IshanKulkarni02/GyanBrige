'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Submission {
  id: string; studentId: string; studentName: string; studentEmail: string;
  content: string; status: string; marksAwarded?: number; feedback: string;
  submittedAt: string; gradedAt?: string;
}
interface Assignment {
  id: string; title: string; description: string; courseId: string;
  courseName: string; courseIcon: string; dueDate?: string;
  totalMarks: number; status: string;
}

const NAV = [
  { icon: '🏠', label: 'Dashboard', href: '/dashboard/teacher' },
  { icon: '📤', label: 'Upload Lecture', href: '/dashboard/teacher/upload' },
  { icon: '📋', label: 'Attendance', href: '/dashboard/teacher/attendance' },
  { icon: '🎙️', label: 'Record', href: '/dashboard/teacher/record' },
  { icon: '📅', label: 'Timetable', href: '/dashboard/teacher/timetable' },
  { icon: '📝', label: 'Exams', href: '/dashboard/teacher/exams' },
  { icon: '📌', label: 'Assignments', href: '/dashboard/teacher/assignments', active: true },
  { icon: '⭐', label: 'Feedback', href: '/dashboard/teacher/feedback' },
  { icon: '📢', label: 'Grievances', href: '/dashboard/teacher/grievances' },
];

export default function TeacherAssignmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [gradeForm, setGradeForm] = useState({ marks: 0, feedback: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'teacher') { router.push('/login'); return; }
    setUser(parsed);
    load();
  }, [id, router]);

  const load = async () => {
    const [aRes, sRes] = await Promise.all([
      authFetch(`/api/assignments/${id}`).then(r => r.json()),
      authFetch(`/api/assignments/${id}/submissions`).then(r => r.json()),
    ]);
    setAssignment(aRes.assignment ?? null);
    setSubmissions(sRes.submissions ?? []);
  };

  const openGrade = (sub: Submission) => {
    setSelected(sub);
    setGradeForm({ marks: sub.marksAwarded ?? 0, feedback: sub.feedback ?? '' });
  };

  const handleGrade = async () => {
    if (!selected) return;
    setSaving(true);
    await authFetch(`/api/assignments/${id}/submissions/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ marksAwarded: gradeForm.marks, feedback: gradeForm.feedback }),
    });
    setSaving(false);
    setSelected(null);
    load();
  };

  if (!user || !assignment) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📌</div></div>;
  }

  const graded = submissions.filter(s => s.status === 'graded').length;

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-6 hidden lg:block">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="text-2xl">📚</span><span className="text-xl font-bold gradient-text">GyanBrige</span>
        </Link>
        <nav className="space-y-2">
          {NAV.map(item => (
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
        <div className="flex items-center gap-3 mb-2">
          <Link href="/dashboard/teacher/assignments" className="text-white/40 hover:text-white/70 text-sm transition">
            ← Assignments
          </Link>
        </div>

        <div className="glass rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">{assignment.title}</h1>
              <p className="text-white/50 text-sm">
                {assignment.courseIcon} {assignment.courseName}
                {assignment.dueDate ? ` · Due ${new Date(assignment.dueDate).toLocaleDateString()}` : ''}
                {` · ${assignment.totalMarks} marks`}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs shrink-0 ${
              assignment.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
              assignment.status === 'closed' ? 'bg-white/5 text-white/30' : 'bg-white/10 text-white/50'
            }`}>{assignment.status}</span>
          </div>
          {assignment.description && (
            <p className="mt-3 text-white/70 text-sm whitespace-pre-wrap">{assignment.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Submissions ({submissions.length})
            <span className="text-white/40 text-sm font-normal ml-2">{graded} graded</span>
          </h2>
        </div>

        {submissions.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-white/40">
            No submissions yet.
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map(sub => (
              <div key={sub.id} className="glass rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{sub.studentName}</span>
                      <span className="text-white/40 text-xs">{sub.studentEmail}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        sub.status === 'graded' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>{sub.status}</span>
                    </div>
                    <p className="text-white/40 text-xs mb-3">
                      Submitted {new Date(sub.submittedAt).toLocaleString()}
                    </p>
                    <p className="text-white/70 text-sm whitespace-pre-wrap line-clamp-3">{sub.content}</p>
                    {sub.status === 'graded' && (
                      <p className="mt-2 text-emerald-400 text-sm font-medium">
                        {sub.marksAwarded}/{assignment.totalMarks} marks
                        {sub.feedback && <span className="text-white/50 font-normal ml-2">· {sub.feedback}</span>}
                      </p>
                    )}
                  </div>
                  <button onClick={() => openGrade(sub)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition shrink-0">
                    {sub.status === 'graded' ? 'Re-grade' : 'Grade'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-1">Grade Submission</h2>
            <p className="text-white/50 text-sm mb-4">{selected.studentName}</p>

            <div className="glass rounded-xl p-4 mb-4 max-h-40 overflow-y-auto">
              <p className="text-white/70 text-sm whitespace-pre-wrap">{selected.content}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-white/40 text-xs mb-1 block">
                  Marks Awarded (out of {assignment.totalMarks})
                </label>
                <input className="input-glass w-full" type="number" min={0} max={assignment.totalMarks}
                  value={gradeForm.marks}
                  onChange={e => setGradeForm(f => ({ ...f, marks: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Feedback (optional)</label>
                <textarea className="input-glass w-full h-20 resize-none" placeholder="Write feedback for the student…"
                  value={gradeForm.feedback}
                  onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setSelected(null)}
                className="flex-1 glass py-2 rounded-xl text-white/70 hover:bg-white/10">Cancel</button>
              <button onClick={handleGrade} disabled={saving}
                className="flex-1 btn-primary disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Grade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
