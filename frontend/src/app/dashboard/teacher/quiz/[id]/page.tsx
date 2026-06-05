'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authFetch } from '@/lib/api';
import { toast } from 'sonner';

interface Question { id: string; question: string; options: string[]; correctAnswer: number; explanation: string; order: number; }
interface Quiz     { id: string; title: string; lectureId: string; courseId: string; questions: Question[]; }

export default function QuizBuilderPage() {
  const router  = useRouter();
  const params  = useParams();
  const quizId  = params.id as string;

  const [quiz,    setQuiz]    = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // New question form
  const [newQ,   setNewQ]   = useState('');
  const [opts,   setOpts]   = useState(['', '', '', '']);
  const [correct,setCorrect]= useState(0);
  const [expl,   setExpl]   = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch {
      localStorage.removeItem('user');
      router.push('/login'); return;
    }
    if (parsed.role !== 'teacher') { router.push('/login'); return; }
    loadQuiz();
  }, [quizId]);

  const loadQuiz = async () => {
    try {
      const res  = await authFetch(`/api/quizzes/${quizId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuiz(data.quiz);
    } catch { toast.error('Failed to load quiz'); }
    finally  { setLoading(false); }
  };

  const addQuestion = async () => {
    if (!newQ.trim() || opts.some(o => !o.trim())) {
      toast.error('Fill in the question and all 4 options');
      return;
    }
    setAdding(true);
    try {
      const res = await authFetch(`/api/quizzes/${quizId}`, {
        method: 'POST',
        body: JSON.stringify({
          question: newQ, options: opts, correctAnswer: correct,
          explanation: expl, order: (quiz?.questions?.length ?? 0) + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuiz(prev => prev ? { ...prev, questions: [...(prev.questions ?? []), data.question] } : prev);
      setNewQ(''); setOpts(['','','','']); setCorrect(0); setExpl('');
      toast.success('Question added');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setAdding(false); }
  };

  const deleteQuestion = async (qid: string) => {
    try {
      await authFetch(`/api/quizzes/${quizId}/questions/${qid}`, { method: 'DELETE' });
      setQuiz(prev => prev ? { ...prev, questions: prev.questions.filter(q => q.id !== qid) } : prev);
      toast.success('Question removed');
    } catch { toast.error('Delete failed'); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-4xl animate-pulse">🧠</div>
    </div>
  );
  if (!quiz) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-white/50">Quiz not found</p>
    </div>
  );

  return (
    <div className="min-h-screen p-6 lg:p-8 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-white/60 hover:text-white mb-6 flex items-center gap-2 transition">
        ← Back
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">🧠 {quiz.title}</h1>
          <p className="text-white/50 text-sm mt-1">{quiz.questions?.length ?? 0} questions</p>
        </div>
        <span className="glass px-3 py-1.5 rounded-full text-xs text-emerald-400">Quiz Builder</span>
      </div>

      {/* Existing questions */}
      {(quiz.questions?.length ?? 0) > 0 && (
        <div className="space-y-4 mb-8">
          {quiz.questions.map((q, i) => (
            <div key={q.id} className="glass rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="font-medium"><span className="text-white/40 mr-2">Q{i+1}.</span>{q.question}</p>
                <button onClick={() => deleteQuestion(q.id)} className="text-white/30 hover:text-red-400 transition shrink-0 text-sm">🗑️</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {q.options.map((opt, j) => (
                  <div key={j} className={`px-3 py-2 rounded-lg text-sm ${j === q.correctAnswer ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/60'}`}>
                    {j === q.correctAnswer && '✓ '}{opt}
                  </div>
                ))}
              </div>
              {q.explanation && <p className="text-white/40 text-xs mt-3 italic">💡 {q.explanation}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Add question form */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-5">➕ Add Question</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Question</label>
            <textarea value={newQ} onChange={e => setNewQ(e.target.value)}
              className="input-glass resize-none min-h-[80px]" placeholder="What is…?" />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">Answer Options — click ✓ to mark correct</label>
            <div className="space-y-2">
              {opts.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button onClick={() => setCorrect(i)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 transition ${correct === i ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/40 hover:bg-white/20'}`}>
                    {correct === i ? '✓' : i + 1}
                  </button>
                  <input value={opt} onChange={e => { const n = [...opts]; n[i] = e.target.value; setOpts(n); }}
                    className="input-glass flex-1" placeholder={`Option ${i + 1}`} />
                </div>
              ))}
            </div>
            <p className="text-white/30 text-xs mt-2">Green circle = correct answer</p>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">Explanation (optional)</label>
            <input value={expl} onChange={e => setExpl(e.target.value)}
              className="input-glass" placeholder="Why is this the correct answer?" />
          </div>

          <button onClick={addQuestion} disabled={adding || !newQ.trim()}
            className="btn-primary w-full py-3 disabled:opacity-50">
            {adding ? '⏳ Adding…' : '+ Add Question'}
          </button>
        </div>
      </div>
    </div>
  );
}
