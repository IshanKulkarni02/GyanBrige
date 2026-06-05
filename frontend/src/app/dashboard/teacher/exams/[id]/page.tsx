'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Question { id: string; question: string; maxMarks: number; expectedAnswer: string; order: number; }
interface Answer { id: string; submissionId: string; questionId: string; answer: string; marksAwarded?: number; teacherFeedback: string; aiSuggestedMarks?: number; aiConfidence?: number; }
interface Submission { id: string; studentId: string; studentName: string; studentEmail: string; status: string; totalMarks?: number; submittedAt?: string; answers: Answer[]; }
interface Exam { id: string; title: string; description: string; courseId: string; courseName: string; status: string; duration: number; totalMarks: number; questions: Question[]; }

export default function TeacherExamDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tab, setTab] = useState<'questions' | 'submissions'>('questions');
  const [qForm, setQForm] = useState({ question: '', maxMarks: 10, expectedAnswer: '' });
  const [addingQ, setAddingQ] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [marks, setMarks] = useState<Record<string, { marks: number; feedback: string }>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiStatus, setAiStatus] = useState('');

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
    const [examRes, subsRes] = await Promise.all([
      authFetch(`/api/exams/${id}`).then(r => r.json()),
      authFetch(`/api/exams/${id}/submissions`).then(r => r.json()),
    ]);
    setExam(examRes.exam ?? null);
    setSubmissions(subsRes.submissions ?? []);
  };

  const addQuestion = async () => {
    if (!qForm.question) return;
    setAddingQ(true);
    await authFetch(`/api/exams/${id}/questions`, { method: 'POST', body: JSON.stringify(qForm) });
    setAddingQ(false);
    setQForm({ question: '', maxMarks: 10, expectedAnswer: '' });
    load();
  };

  const deleteQuestion = async (qid: string) => {
    await authFetch(`/api/exams/${id}/questions/${qid}`, { method: 'DELETE' });
    load();
  };

  const openMark = (sub: Submission) => {
    setSelectedSub(sub);
    const init: Record<string, { marks: number; feedback: string }> = {};
    for (const a of sub.answers) {
      init[a.id] = { marks: a.marksAwarded ?? 0, feedback: a.teacherFeedback ?? '' };
    }
    setMarks(init);
    setAiStatus('');
  };

  const getAISuggestions = async () => {
    if (!selectedSub) return;
    setAiLoading(true);
    setAiStatus('Asking AI…');
    const aiSettings = JSON.parse(localStorage.getItem('aiSettings') ?? '{}');
    const headers: Record<string, string> = {};
    if (aiSettings.useLocalAI) headers['x-use-local-ai'] = 'true';
    if (aiSettings.openAIKey) headers['x-openai-key'] = aiSettings.openAIKey;
    if (aiSettings.openAIModel) headers['x-openai-model'] = aiSettings.openAIModel;
    if (aiSettings.ollamaModel) headers['x-ollama-model'] = aiSettings.ollamaModel;

    const res = await authFetch(`/api/exams/${id}/submissions/${selectedSub.id}/ai-suggest`, { method: 'POST', headers });
    const data = await res.json();
    setAiLoading(false);
    if (!res.ok) { setAiStatus(data.error ?? 'AI failed'); return; }

    const { suggestions } = data;
    setMarks(prev => {
      const next = { ...prev };
      for (const [answerId, sug] of Object.entries(suggestions as Record<string, { suggestedMarks: number; confidence: number; reasoning: string }>)) {
        next[answerId] = { marks: sug.suggestedMarks, feedback: sug.reasoning };
      }
      return next;
    });
    const trainingCount = submissions.filter(s => s.status === 'marked').length;
    setAiStatus(trainingCount >= 3
      ? `AI suggested marks (trained on ${trainingCount} marked submissions)`
      : `AI suggested marks (learning phase — ${trainingCount}/3 examples so far)`
    );
  };

  const saveMark = async () => {
    if (!selectedSub) return;
    setSaving(true);
    await authFetch(`/api/exams/${id}/submissions/${selectedSub.id}/mark`, { method: 'POST', body: JSON.stringify({ marks }) });
    setSaving(false);
    setSelectedSub(null);
    load();
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-white/10 text-white/50', active: 'bg-emerald-500/20 text-emerald-400', closed: 'bg-white/5 text-white/30',
    submitted: 'bg-amber-500/20 text-amber-400', marked: 'bg-emerald-500/20 text-emerald-400', in_progress: 'bg-blue-500/20 text-blue-400',
  };

  if (!user || !exam) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📝</div></div>;

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-6 hidden lg:block">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="text-2xl">📚</span><span className="text-xl font-bold gradient-text">GyanBrige</span>
        </Link>
        <nav className="space-y-2">
          {[
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/teacher' },
            { icon: '📤', label: 'Upload Lecture', href: '/dashboard/teacher/upload' },
            { icon: '📋', label: 'Attendance', href: '/dashboard/teacher/attendance' },
            { icon: '🎙️', label: 'Record', href: '/dashboard/teacher/record' },
            { icon: '📅', label: 'Timetable', href: '/dashboard/teacher/timetable' },
            { icon: '📝', label: 'Exams', href: '/dashboard/teacher/exams', active: true },
            { icon: '⭐', label: 'Feedback', href: '/dashboard/teacher/feedback' },
            { icon: '📢', label: 'Grievances', href: '/dashboard/teacher/grievances' },
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
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard/teacher/exams" className="text-white/40 hover:text-white/70 text-sm">Exams</Link>
              <span className="text-white/20">›</span>
              <span className="text-sm">{exam.title}</span>
            </div>
            <h1 className="text-2xl font-bold">{exam.title}</h1>
            <p className="text-white/50 text-sm">{exam.courseName} · {exam.duration} min · {exam.totalMarks} marks</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm ${statusColor[exam.status] ?? ''}`}>{exam.status}</span>
        </div>

        {/* AI training notice */}
        {submissions.filter(s => s.status === 'marked').length < 3 && submissions.filter(s => s.status === 'submitted').length > 0 && (
          <div className="glass rounded-xl p-4 mb-5 border border-amber-500/20">
            <p className="text-amber-400 text-sm">
              🧠 AI marking is in <strong>learning mode</strong> — mark {3 - submissions.filter(s => s.status === 'marked').length} more submission{submissions.filter(s => s.status === 'marked').length < 2 ? 's' : ''} manually so the AI can learn your grading style.
            </p>
          </div>
        )}
        {submissions.filter(s => s.status === 'marked').length >= 3 && (
          <div className="glass rounded-xl p-4 mb-5 border border-emerald-500/20">
            <p className="text-emerald-400 text-sm">
              🤖 AI is now <strong>suggesting marks</strong> based on {submissions.filter(s => s.status === 'marked').length} marked submissions. Click "AI Suggest" on any submission.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['questions', 'submissions'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm transition ${tab === t ? 'bg-emerald-500/20 text-emerald-400' : 'glass text-white/60 hover:bg-white/10'}`}>
              {t === 'questions' ? `Questions (${exam.questions.length})` : `Submissions (${submissions.length})`}
            </button>
          ))}
        </div>

        {tab === 'questions' && (
          <div className="space-y-4">
            {exam.questions.map((q, i) => (
              <div key={q.id} className="glass rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium mb-1"><span className="text-white/40 mr-2">Q{i + 1}.</span>{q.question}</p>
                    {q.expectedAnswer && <p className="text-white/40 text-sm mt-1"><span className="text-white/30">Model answer: </span>{q.expectedAnswer}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-2 py-1 glass rounded-lg text-sm">{q.maxMarks} marks</span>
                    {exam.status === 'draft' && (
                      <button onClick={() => deleteQuestion(q.id)} className="text-white/20 hover:text-red-400 transition">×</button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {exam.status === 'draft' && (
              <div className="glass rounded-xl p-5">
                <h3 className="font-medium mb-3 text-white/70">Add Question</h3>
                <div className="space-y-3">
                  <textarea className="input-glass w-full h-20 resize-none" placeholder="Question text" value={qForm.question} onChange={e => setQForm(f => ({ ...f, question: e.target.value }))} />
                  <textarea className="input-glass w-full h-16 resize-none" placeholder="Model answer (used by AI for marking guidance)" value={qForm.expectedAnswer} onChange={e => setQForm(f => ({ ...f, expectedAnswer: e.target.value }))} />
                  <div className="flex items-center gap-3">
                    <input className="input-glass w-32" type="number" min={1} value={qForm.maxMarks} onChange={e => setQForm(f => ({ ...f, maxMarks: Number(e.target.value) }))} />
                    <span className="text-white/40 text-sm">marks</span>
                    <button onClick={addQuestion} disabled={addingQ || !qForm.question} className="ml-auto btn-primary disabled:opacity-50">
                      {addingQ ? 'Adding…' : '+ Add Question'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'submissions' && (
          <div className="space-y-3">
            {submissions.length === 0 && <div className="glass rounded-xl p-8 text-center text-white/40">No submissions yet.</div>}
            {submissions.map(s => (
              <div key={s.id} className="glass rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.studentName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor[s.status] ?? ''}`}>{s.status}</span>
                  </div>
                  <p className="text-white/40 text-xs">{s.studentEmail}{s.submittedAt ? ` · submitted ${new Date(s.submittedAt).toLocaleString()}` : ''}</p>
                  {s.totalMarks != null && <p className="text-emerald-400 text-sm mt-1">{s.totalMarks}/{exam.totalMarks} marks</p>}
                </div>
                {s.status === 'submitted' && (
                  <button onClick={() => openMark(s)} className="btn-primary text-sm">Mark</button>
                )}
                {s.status === 'marked' && (
                  <button onClick={() => openMark(s)} className="glass px-3 py-1.5 rounded-lg text-sm hover:bg-white/10">Review</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Marking modal */}
        {selectedSub && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="glass rounded-2xl p-6 w-full max-w-2xl my-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Marking: {selectedSub.studentName}</h2>
                <button onClick={() => setSelectedSub(null)} className="text-white/40 hover:text-white/70">✕</button>
              </div>

              {aiStatus && <p className="text-sm text-emerald-400/80 mb-4 glass rounded-xl p-3">{aiStatus}</p>}

              <div className="space-y-5 mb-5">
                {exam.questions.map((q, i) => {
                  const answer = selectedSub.answers.find(a => a.questionId === q.id);
                  const m = marks[answer?.id ?? ''] ?? { marks: 0, feedback: '' };
                  return (
                    <div key={q.id} className="glass rounded-xl p-4">
                      <p className="font-medium mb-2 text-sm"><span className="text-white/40">Q{i + 1}.</span> {q.question} <span className="text-white/30">({q.maxMarks} marks)</span></p>
                      <div className="bg-white/5 rounded-lg p-3 mb-3">
                        <p className="text-white/70 text-sm">{answer?.answer || <span className="text-white/30 italic">No answer</span>}</p>
                      </div>
                      {answer && (
                        <>
                          {answer.aiSuggestedMarks != null && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-purple-400">🤖 AI suggests: {answer.aiSuggestedMarks} marks ({Math.round((answer.aiConfidence ?? 0) * 100)}% confidence)</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <input type="number" min={0} max={q.maxMarks} value={m.marks}
                              onChange={e => setMarks(prev => ({ ...prev, [answer.id]: { ...m, marks: Number(e.target.value) } }))}
                              className="input-glass w-20 text-center" />
                            <span className="text-white/40 text-sm">/ {q.maxMarks}</span>
                            <input className="input-glass flex-1" placeholder="Feedback for student" value={m.feedback}
                              onChange={e => setMarks(prev => ({ ...prev, [answer.id]: { ...m, feedback: e.target.value } }))} />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={getAISuggestions} disabled={aiLoading} className="flex-1 glass py-2 rounded-xl text-purple-400 hover:bg-purple-500/10 disabled:opacity-50 transition">
                  {aiLoading ? '⏳ Asking AI…' : '🤖 AI Suggest'}
                </button>
                <button onClick={saveMark} disabled={saving} className="flex-1 btn-primary disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Marks'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
