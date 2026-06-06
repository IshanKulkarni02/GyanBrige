'use client';

import Link from 'next/link';
import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';

interface Question { id: string; question: string; maxMarks: number; order: number; }
interface Answer { id: string; questionId: string; answer: string; marksAwarded?: number; teacherFeedback: string; aiSuggestedMarks?: number; }
interface Exam { id: string; title: string; description: string; courseName: string; courseIcon: string; duration: number; totalMarks: number; status: string; questions: Question[]; }
interface Submission { id: string; status: string; totalMarks?: number; submittedAt?: string; }

export default function StudentExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'intro' | 'exam' | 'submitted' | 'results'>('loading');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { router.push('/login'); return; }
    if (parsed.role !== 'student') { router.push('/login'); return; }
    setUser(parsed);
    loadExam();
  }, [id, router]);

  const loadExam = async () => {
    const examRes = await authFetch(`/api/exams/${id}`);
    const { exam: e } = await examRes.json();
    if (!e) { router.push('/dashboard/student/exams'); return; }
    setExam(e);

    // Check existing submission
    const subRes = await authFetch(`/api/exams/${id}/submit`);
    if (subRes.ok) {
      const { submission: sub, answers: existingAnswers } = await subRes.json();
      setSubmission(sub);
      if (sub.status === 'submitted' || sub.status === 'marked') {
        setSavedAnswers(existingAnswers ?? []);
        setPhase(sub.status === 'marked' ? 'results' : 'submitted');
        return;
      }
      // Resume in-progress
      const answerMap: Record<string, string> = {};
      for (const a of (existingAnswers ?? [])) answerMap[a.questionId] = a.answer;
      setAnswers(answerMap);
      const elapsed = Math.floor((Date.now() - new Date(sub.startedAt).getTime()) / 1000);
      const remaining = e.duration * 60 - elapsed;
      setTimeLeft(Math.max(0, remaining));
      setPhase('exam');
    } else {
      setPhase('intro');
    }
  };

  // Timer
  useEffect(() => {
    if (phase !== 'exam' || timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => (t ?? 1) - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timeLeft, phase]);

  const startExam = async () => {
    const res = await authFetch(`/api/exams/${id}/submit`);
    const { submission: sub } = await res.json();
    setSubmission(sub);
    setTimeLeft(exam!.duration * 60);
    setPhase('exam');
  };

  const handleSubmit = async () => {
    if (!submission || submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    await authFetch(`/api/exams/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) });
    setSubmitting(false);
    setPhase('submitted');
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const isLowTime = (timeLeft ?? 999) < 120;

  if (!user || phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📝</div></div>
  );

  if (phase === 'submitted') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">Submitted!</h1>
        <p className="text-white/60 mb-6">Your answers have been saved. Your teacher will mark them soon.</p>
        <Link href="/dashboard/student/exams" className="btn-primary inline-block">Back to Exams</Link>
      </div>
    </div>
  );

  if (phase === 'results' && exam) return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-6 hidden lg:block">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="text-2xl">📚</span><span className="text-xl font-bold gradient-text">GyanBrige</span>
        </Link>
        <nav className="space-y-2">
          {[
            { icon: '🏠', label: 'Dashboard', href: '/dashboard/student' },
            { icon: '📝', label: 'Exams', href: '/dashboard/student/exams', active: true },
          ].map(item => (
            <Link key={item.label} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${item.active ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/70 hover:bg-white/5'}`}>
              <span>{item.icon}</span><span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="lg:ml-64 p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{exam.title} — Results</h1>
          <p className="text-white/60">{exam.courseIcon} {exam.courseName}</p>
        </div>
        <div className="glass rounded-xl p-5 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <span className="text-2xl font-bold">{submission?.totalMarks ?? 0}</span>
          </div>
          <div>
            <p className="text-white/40 text-sm">Total Marks</p>
            <p className="text-2xl font-bold">{submission?.totalMarks ?? 0} / {exam.totalMarks}</p>
          </div>
        </div>
        <div className="space-y-4">
          {exam.questions.map((q, i) => {
            const a = savedAnswers.find(a => a.questionId === q.id);
            return (
              <div key={q.id} className="glass rounded-xl p-5">
                <p className="font-medium mb-2"><span className="text-white/40">Q{i + 1}.</span> {q.question} <span className="text-white/30">({q.maxMarks} marks)</span></p>
                <div className="bg-white/5 rounded-lg p-3 mb-3">
                  <p className="text-white/70 text-sm">{a?.answer || <span className="text-white/30 italic">No answer</span>}</p>
                </div>
                {a?.marksAwarded != null && (
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-semibold">{a.marksAwarded}/{q.maxMarks}</span>
                    {a.teacherFeedback && <span className="text-white/50 text-sm italic">"{a.teacherFeedback}"</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );

  if (phase === 'intro' && exam) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full">
        <div className="text-4xl mb-4">📝</div>
        <h1 className="text-2xl font-bold mb-1">{exam.title}</h1>
        <p className="text-white/50 mb-5">{exam.courseIcon} {exam.courseName}</p>
        <div className="space-y-3 mb-6">
          {[
            { icon: '⏱', label: 'Duration', value: `${exam.duration} minutes` },
            { icon: '📊', label: 'Total Marks', value: String(exam.totalMarks) },
            { icon: '❓', label: 'Questions', value: String(exam.questions.length) },
          ].map(item => (
            <div key={item.label} className="glass rounded-xl p-3 flex items-center gap-3">
              <span className="text-xl">{item.icon}</span>
              <span className="text-white/60 flex-1">{item.label}</span>
              <span className="font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
        {exam.description && <p className="text-white/50 text-sm mb-5">{exam.description}</p>}
        <div className="glass rounded-xl p-4 mb-5 border border-amber-500/20">
          <p className="text-amber-400 text-sm">⚠️ Once you start, the timer begins. Write your answers carefully — you cannot un-submit.</p>
        </div>
        <button onClick={startExam} className="btn-primary w-full text-center">Start Exam</button>
      </div>
    </div>
  );

  // Exam phase
  if (phase === 'exam' && exam) {
    const q = exam.questions[currentQ];
    return (
      <div className="min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="glass border-b border-white/10 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <span className="font-semibold">{exam.title}</span>
          <div className={`font-mono text-lg font-bold px-4 py-1.5 rounded-xl ${isLowTime ? 'bg-red-500/20 text-red-400 animate-pulse' : 'glass text-emerald-400'}`}>
            ⏱ {fmt(timeLeft ?? 0)}
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit Exam'}
          </button>
        </div>

        <div className="flex flex-1">
          {/* Question list sidebar */}
          <div className="w-20 lg:w-48 glass border-r border-white/10 p-3 flex flex-col gap-2 overflow-y-auto">
            {exam.questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setCurrentQ(i)}
                className={`rounded-xl py-2 px-3 text-sm font-medium transition text-left ${i === currentQ ? 'bg-emerald-500/20 text-emerald-400' : answers[qq.id] ? 'bg-white/10 text-white/70' : 'text-white/30 hover:bg-white/5'}`}>
                <span className="lg:hidden">Q{i + 1}</span>
                <span className="hidden lg:block">Q{i + 1} {answers[qq.id] ? '✓' : ''}</span>
              </button>
            ))}
          </div>

          {/* Question area */}
          <div className="flex-1 p-6 lg:p-8 max-w-3xl">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-white/40 text-sm">Question {currentQ + 1} of {exam.questions.length}</span>
              <span className="glass px-2 py-0.5 rounded-lg text-xs text-white/50">{q.maxMarks} marks</span>
            </div>
            <p className="text-xl font-medium mb-6">{q.question}</p>
            <textarea
              className="input-glass w-full min-h-48 resize-y text-base"
              placeholder="Write your answer here…"
              value={answers[q.id] ?? ''}
              onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
            />
            <div className="flex justify-between mt-4">
              <button onClick={() => setCurrentQ(i => Math.max(0, i - 1))} disabled={currentQ === 0}
                className="glass px-4 py-2 rounded-xl text-white/60 hover:bg-white/10 disabled:opacity-30 transition">
                ← Previous
              </button>
              {currentQ < exam.questions.length - 1 ? (
                <button onClick={() => setCurrentQ(i => i + 1)} className="btn-primary">Next →</button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary disabled:opacity-50">
                  {submitting ? 'Submitting…' : 'Submit Exam ✓'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
