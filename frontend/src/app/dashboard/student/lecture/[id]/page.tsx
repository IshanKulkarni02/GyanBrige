'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authFetch } from '@/lib/api';
import { toast } from 'sonner';

interface Chapter { startSec: number; title: string; }
interface QuizQuestion {
  id: string; order: number;
  question: string; options: string[];
  correctAnswer: number; explanation: string;
}
interface Quiz { id: string; title: string; questions?: QuizQuestion[]; }
interface Lecture {
  id: string; courseId: string; title: string; description: string;
  videoUrl?: string; duration: number; notes: string; order: number;
  chapters: Chapter[];
}
interface Course { id: string; name: string; icon: string; color: string; }
interface UserData { id: string; name: string; role: string; }

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LecturePlayerPage() {
  const router    = useRouter();
  const params    = useParams();
  const lectureId = params.id as string;

  const [user,    setUser]    = useState<UserData | null>(null);
  const [lecture, setLecture] = useState<Lecture  | null>(null);
  const [course,  setCourse]  = useState<Course   | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'chapters' | 'notes' | 'quiz'>('chapters');
  const [completed,     setCompleted]     = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime,   setCurrentTime]   = useState(0);
  const [activeChapter, setActiveChapter] = useState(0);

  // Online attendance: track watch progress + periodic attention check
  const [watchedPct,      setWatchedPct]      = useState(0);       // % of video watched
  const [onlineCheckedIn, setOnlineCheckedIn] = useState(false);   // sent online checkin
  const [attentionPrompt, setAttentionPrompt] = useState(false);   // show "are you still watching?" modal
  const [attentionTimer,  setAttentionTimer]  = useState(0);       // countdown seconds
  const watchedSecsRef   = useRef<Set<number>>(new Set());
  const attentionRef     = useRef<ReturnType<typeof setInterval>|null>(null);
  const attentionCountRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const parsed = JSON.parse(stored);
    if (parsed.role !== 'student') { router.push('/login'); return; }
    setUser(parsed);
    loadLecture();
  }, [router, lectureId]);

  useEffect(() => {
    if (!lecture?.chapters?.length) return;
    const idx = [...lecture.chapters].reverse().findIndex(c => c.startSec <= currentTime);
    if (idx !== -1) setActiveChapter(lecture.chapters.length - 1 - idx);
  }, [currentTime, lecture]);

  const loadLecture = async () => {
    try {
      const [lectureRes, quizRes] = await Promise.all([
        authFetch(`/api/lectures/${lectureId}`),
        authFetch(`/api/quizzes?lectureId=${lectureId}`),
      ]);
      const lectureData = await lectureRes.json();
      const quizData    = await quizRes.json();
      setLecture(lectureData.lecture);
      setQuizzes(quizData.quizzes ?? []);
      if (lectureData.lecture?.courseId) {
        const cr = await authFetch(`/api/courses/${lectureData.lecture.courseId}`);
        setCourse((await cr.json()).course);
      }
      // Default to chapters if they exist, else notes
      if (!(lectureData.lecture?.chapters?.length)) setTab('notes');
    } catch { toast.error('Failed to load lecture'); }
    finally  { setLoading(false); }
  };

  const seekToChapter = (ch: Chapter) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = ch.startSec;
    videoRef.current.play();
  };

  // ── Track video seconds watched ────────────────────────────────────────────
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = Math.floor(e.currentTarget.currentTime);
    setCurrentTime(e.currentTarget.currentTime);
    watchedSecsRef.current.add(t);
    if (videoDuration > 0) {
      const pct = Math.round((watchedSecsRef.current.size / videoDuration) * 100);
      setWatchedPct(pct);
      // Auto online check-in when 80% watched
      if (pct >= 80 && !onlineCheckedIn && user && lecture?.courseId) {
        setOnlineCheckedIn(true);
        checkInOnline();
      }
    }
  };

  const checkInOnline = async () => {
    if (!user || !lecture) return;
    try {
      // Find active session for this course
      const r = await authFetch(`/api/attendance/sessions?courseId=${lecture.courseId}`);
      const d = await r.json();
      const active = (d.sessions ?? []).find((s: { status: string }) => s.status === 'active');
      if (active) {
        await authFetch(`/api/attendance/sessions/${active.id}/checkin`, {
          method: 'POST',
          body: JSON.stringify({ studentId: user.id, method: 'online', status: 'remote', proofType: 'watch_progress' }),
        });
        toast.success('📺 Online attendance recorded (80% watched)');
      }
    } catch { /* silent — they can still be marked manually */ }
  };

  // ── Periodic attention check (every N minutes) ──────────────────────────────
  useEffect(() => {
    if (attentionRef.current) clearInterval(attentionRef.current);
    if (videoDuration === 0) return;
    // Fetch policy for check interval
    let intervalMs = 15 * 60 * 1000; // default 15 min
    if (lecture?.courseId) {
      authFetch(`/api/attendance/policy?courseId=${lecture.courseId}`)
        .then(r => r.json())
        .then(d => { if (d.policy?.webcamCheckInterval) intervalMs = d.policy.webcamCheckInterval * 60 * 1000; })
        .catch(() => {});
    }
    attentionRef.current = setInterval(() => {
      if (!videoRef.current?.paused) {
        videoRef.current?.pause();
        setAttentionTimer(30);
        setAttentionPrompt(true);
      }
    }, intervalMs);
    return () => { if (attentionRef.current) clearInterval(attentionRef.current); };
  }, [videoDuration, lecture?.courseId]);

  useEffect(() => {
    if (attentionCountRef.current) clearInterval(attentionCountRef.current);
    if (!attentionPrompt) return;
    attentionCountRef.current = setInterval(() => {
      setAttentionTimer(prev => {
        if (prev <= 1) {
          clearInterval(attentionCountRef.current!);
          setAttentionPrompt(false);
          // Missed check — don't penalize, just dismiss
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (attentionCountRef.current) clearInterval(attentionCountRef.current); };
  }, [attentionPrompt]);

  const confirmAttention = () => {
    setAttentionPrompt(false);
    videoRef.current?.play();
    toast.success('✓ Attention confirmed');
  };

  const markAsComplete = async () => {
    if (!user || !lecture || !course) return;
    try {
      await authFetch('/api/progress', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, courseId: course.id, lectureId: lecture.id }),
      });
      setCompleted(true);
      toast.success('Lecture marked as complete!');
    } catch { toast.error('Failed to mark complete'); }
  };

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4 animate-pulse">🎬</div><p className="text-white/60">Loading...</p></div>
    </div>
  );

  if (!lecture) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">❌</div>
        <p className="text-white/60">Lecture not found</p>
        <Link href="/dashboard/student" className="text-emerald-400 mt-4 inline-block">← Dashboard</Link>
      </div>
    </div>
  );

  const chapters = lecture.chapters ?? [];

  // Build tab list dynamically
  type TabId = 'chapters' | 'notes' | 'quiz';
  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'chapters', label: `🔖 Chapters (${chapters.length})`, show: chapters.length > 0 },
    { id: 'notes',    label: '📝 Notes',                        show: true },
    { id: 'quiz',     label: `🧠 Quiz (${quizzes.length})`,     show: quizzes.length > 0 },
  ];
  const visibleTabs = tabs.filter(t => t.show);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Attention check modal */}
      {attentionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass rounded-2xl p-8 text-center max-w-sm w-full">
            <div className="text-5xl mb-4">👁️</div>
            <h2 className="text-xl font-bold mb-2">Are you still watching?</h2>
            <p className="text-white/60 text-sm mb-4">Click confirm to continue. Attendance requires your attention.</p>
            <div className="text-3xl font-mono text-amber-400 mb-5">{attentionTimer}s</div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-5">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{width:`${(attentionTimer/30)*100}%`}} />
            </div>
            <button onClick={confirmAttention} className="btn-primary w-full py-3">✓ Yes, I&apos;m here</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="glass border-b border-white/10 p-4 shrink-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href={course ? `/dashboard/student/course/${course.id}` : '/dashboard/student'} className="text-white/60 hover:text-white">← Back</Link>
            {course && <div className="flex items-center gap-2"><span className="text-xl">{course.icon}</span><span className="text-white/60 hidden sm:block">{course.name}</span></div>}
          </div>
          {!completed
            ? <button onClick={markAsComplete} className="btn-primary px-4 py-2 text-sm">✓ Mark Complete</button>
            : <span className="text-emerald-400 text-sm flex items-center gap-1">✅ Completed</span>
          }
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Video column ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Video */}
          <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
            {lecture.videoUrl ? (
              <video
                ref={videoRef}
                src={lecture.videoUrl}
                className="w-full h-full"
                controls
                controlsList="nodownload"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={e => setVideoDuration(e.currentTarget.duration)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <div className="text-center"><span className="text-5xl block mb-3">🎬</span><p>No video for this lecture</p></div>
              </div>
            )}
            {chapters.length > 1 && videoDuration > 0 && (
              <div className="absolute bottom-[52px] left-0 right-0 h-1 pointer-events-none px-3">
                {chapters.slice(1).map((ch, i) => (
                  <div key={i} className="absolute top-0 w-0.5 h-full bg-white/60 rounded"
                    style={{ left: `${(ch.startSec / videoDuration) * 100}%` }} />
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="p-5">
            <h1 className="text-xl font-bold mb-1">{lecture.title}</h1>
            <p className="text-white/50 text-sm mb-3">{lecture.description}</p>
            {chapters.length > 0 && (
              <div className="inline-flex items-center gap-2 glass px-3 py-1.5 rounded-full text-sm">
                <span className="text-emerald-400">▶</span>
                <span className="text-white/80">{chapters[activeChapter]?.title}</span>
                {videoDuration > 0 && <span className="text-white/40">{fmtTime(currentTime)}</span>}
              </div>
            )}
          </div>

          {/* Watch progress bar */}
          {videoDuration > 0 && (
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${watchedPct>=80?'bg-emerald-500':'bg-purple-500'}`} style={{width:`${watchedPct}%`}} />
                </div>
                <span className="text-xs text-white/40 shrink-0">{watchedPct}% watched</span>
                {watchedPct>=80 && onlineCheckedIn && <span className="text-xs text-emerald-400 shrink-0">📺 Attendance recorded</span>}
              </div>
            </div>
          )}

          {/* Mobile tab switcher */}
          <div className="lg:hidden flex border-t border-white/10 overflow-x-auto">
            {visibleTabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-3 text-sm font-medium whitespace-nowrap px-4 ${tab === t.id ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-white/50'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Mobile panel */}
          <div className="lg:hidden overflow-y-auto">
            {tab === 'chapters' && <ChapterList chapters={chapters} activeChapter={activeChapter} onSeek={seekToChapter} videoDuration={videoDuration} />}
            {tab === 'notes'    && <NotesPanel notes={lecture.notes} />}
            {tab === 'quiz'     && <QuizPanel quizzes={quizzes} userId={user?.id ?? ''} />}
          </div>
        </div>

        {/* ── Right panel (desktop) ── */}
        <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col border-l border-white/10 bg-black/30 shrink-0">
          <div className="flex border-b border-white/10 shrink-0 overflow-x-auto">
            {visibleTabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-3 text-sm font-medium whitespace-nowrap px-2 transition ${tab === t.id ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-white/40 hover:text-white/70'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {tab === 'chapters' && <ChapterList chapters={chapters} activeChapter={activeChapter} onSeek={seekToChapter} videoDuration={videoDuration} />}
            {(tab === 'notes' || chapters.length === 0) && tab !== 'quiz' && <NotesPanel notes={lecture.notes} />}
            {tab === 'quiz'     && <QuizPanel quizzes={quizzes} userId={user?.id ?? ''} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Chapter list ──────────────────────────────────────────────────────────────

function ChapterList({ chapters, activeChapter, onSeek, videoDuration }: {
  chapters: Chapter[]; activeChapter: number; onSeek: (ch: Chapter) => void; videoDuration: number;
}) {
  return (
    <div className="divide-y divide-white/5">
      {chapters.map((ch, i) => {
        const next     = chapters[i + 1];
        const duration = next ? next.startSec - ch.startSec : (videoDuration ? videoDuration - ch.startSec : null);
        const isActive = i === activeChapter;
        return (
          <button key={i} onClick={() => onSeek(ch)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${isActive ? 'bg-emerald-500/10' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isActive ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50'}`}>{i + 1}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isActive ? 'text-emerald-400' : 'text-white/80'}`}>{ch.title}</p>
              <p className="text-xs text-white/40 mt-0.5">
                {fmtTime(ch.startSec)}{duration ? <span className="ml-1">· {Math.round(duration / 60)} min</span> : null}
              </p>
            </div>
            {isActive && <span className="text-emerald-400 text-xs shrink-0">▶ Now</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Notes panel ───────────────────────────────────────────────────────────────

function NotesPanel({ notes }: { notes: string }) {
  if (!notes) return (
    <div className="p-6 text-center"><span className="text-4xl block mb-3">📝</span><p className="text-white/40 text-sm">No notes for this lecture.</p></div>
  );
  return (
    <div className="p-5 space-y-2">
      {notes.split('\n').map((line, i) => {
        if (line.startsWith('# '))   return <h1 key={i} className="text-lg font-bold text-emerald-400 mt-4 first:mt-0">{line.slice(2)}</h1>;
        if (line.startsWith('## '))  return <h2 key={i} className="text-base font-semibold text-purple-400 mt-3">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-medium text-blue-400 mt-2">{line.slice(4)}</h3>;
        if (line.startsWith('- '))   return <p  key={i} className="text-white/70 text-sm pl-3">• {line.slice(2)}</p>;
        if (line.trim() === '---')   return <hr key={i} className="border-white/10 my-3" />;
        if (line.trim())             return <p  key={i} className="text-white/60 text-sm">{line}</p>;
        return null;
      })}
    </div>
  );
}

// ── Quiz panel ────────────────────────────────────────────────────────────────

function QuizPanel({ quizzes, userId }: { quizzes: Quiz[]; userId: string }) {
  const [activeQuiz,  setActiveQuiz]  = useState<Quiz | null>(null);
  const [answers,     setAnswers]     = useState<Record<number, number>>({});
  const [submitted,   setSubmitted]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [attendanceMarked, setAttendanceMarked] = useState(false);

  const openQuiz = async (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setSubmitted(false);
    setAttendanceMarked(false);
    // Load previous attempt
    const r = await authFetch(`/api/quizzes/${quiz.id}/attempt?userId=${userId}`);
    const d = await r.json().catch(() => ({}));
    if (d.attempt) {
      setAnswers(d.attempt.answers ?? {});
      setSubmitted(true);
    } else {
      setAnswers({});
    }
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);
    try {
      const r = await authFetch(`/api/quizzes/${activeQuiz.id}/attempt`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSubmitted(true);
      if (d.attendanceCheckin) setAttendanceMarked(true);
    } catch (e) {
      console.error('Quiz submit failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  if (!quizzes.length) return (
    <div className="p-6 text-center">
      <span className="text-4xl block mb-3">🧠</span>
      <p className="text-white/40 text-sm">No quizzes for this lecture yet.</p>
    </div>
  );

  // ── Quiz list ───────────────────────────────────────────────────────────────
  if (!activeQuiz) return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-white/40 mb-4">Test your understanding of this lecture:</p>
      {quizzes.map(quiz => (
        <button key={quiz.id} onClick={() => openQuiz(quiz)}
          className="w-full glass rounded-xl p-4 text-left hover:bg-white/5 transition group">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-sm group-hover:text-emerald-400 transition">{quiz.title}</p>
              <p className="text-white/40 text-xs mt-1">
                {quiz.questions?.length ?? 0} question{(quiz.questions?.length ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
            <span className="text-white/30 group-hover:text-emerald-400 transition mt-0.5">▶</span>
          </div>
        </button>
      ))}
    </div>
  );

  const questions = activeQuiz.questions ?? [];
  const answered  = Object.keys(answers).length;
  const score     = submitted
    ? questions.filter((q, i) => answers[i] === q.correctAnswer).length
    : 0;

  // ── Taking quiz / results ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Quiz header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <button onClick={() => setActiveQuiz(null)} className="text-white/40 hover:text-white text-lg leading-none">←</button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{activeQuiz.title}</p>
          <p className="text-xs text-white/40">{questions.length} questions</p>
        </div>
        {submitted && (
          <div className={`text-xs font-bold px-2 py-1 rounded-full ${score / questions.length >= 0.7 ? 'bg-emerald-500/20 text-emerald-400' : score / questions.length >= 0.5 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
            {score}/{questions.length}
          </div>
        )}
      </div>

      {/* Score banner (after submit) */}
      {submitted && (
        <div className={`mx-4 mt-4 rounded-xl p-4 text-center ${score === questions.length ? 'bg-emerald-500/15 border border-emerald-500/30' : score / questions.length >= 0.7 ? 'bg-blue-500/15 border border-blue-500/30' : 'bg-amber-500/15 border border-amber-500/30'}`}>
          <p className="text-2xl font-bold mb-1">
            {score === questions.length ? '🎉' : score / questions.length >= 0.7 ? '👍' : '📚'}
            {' '}{Math.round((score / questions.length) * 100)}%
          </p>
          <p className="text-sm text-white/70">
            {score === questions.length ? 'Perfect score!' : score / questions.length >= 0.7 ? 'Good job!' : 'Keep studying!'}
            {' '}{score} of {questions.length} correct
          </p>
          {attendanceMarked && (
            <p className="text-xs text-emerald-400 mt-2">✓ Attendance marked (quiz passed)</p>
          )}
          <button onClick={() => { setAnswers({}); setSubmitted(false); setAttendanceMarked(false); }}
            className="mt-3 text-xs text-white/50 hover:text-white underline">Retry quiz</button>
        </div>
      )}

      {/* Questions */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {questions.map((q, qi) => {
          const selected  = answers[qi];
          const isCorrect = submitted && selected === q.correctAnswer;
          const isWrong   = submitted && selected !== undefined && selected !== q.correctAnswer;

          return (
            <div key={q.id} className={`rounded-xl p-4 border transition ${
              !submitted ? 'border-white/10 bg-white/3' :
              isCorrect  ? 'border-emerald-500/40 bg-emerald-500/8' :
              isWrong    ? 'border-red-500/40 bg-red-500/8' :
              'border-white/10 bg-white/3'
            }`}>
              {/* Question number + text */}
              <div className="flex gap-2 mb-3">
                <span className="text-xs font-bold text-white/30 shrink-0 mt-0.5">Q{qi + 1}</span>
                <p className="text-sm text-white/90 leading-relaxed">{q.question}</p>
              </div>

              {/* Options */}
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isSelected   = selected === oi;
                  const isThisCorrect = q.correctAnswer === oi;
                  let optStyle = 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20';
                  if (!submitted && isSelected) optStyle = 'border-purple-500/60 bg-purple-500/15';
                  if (submitted && isThisCorrect) optStyle = 'border-emerald-500/60 bg-emerald-500/12';
                  if (submitted && isSelected && !isThisCorrect) optStyle = 'border-red-500/60 bg-red-500/12';

                  return (
                    <button key={oi} disabled={submitted}
                      onClick={() => setAnswers(prev => ({ ...prev, [qi]: oi }))}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition ${optStyle} disabled:cursor-default`}>
                      {/* Circle indicator */}
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold ${
                        submitted && isThisCorrect ? 'border-emerald-500 bg-emerald-500 text-white' :
                        submitted && isSelected && !isThisCorrect ? 'border-red-500 bg-red-500 text-white' :
                        isSelected ? 'border-purple-400 bg-purple-500 text-white' :
                        'border-white/20'
                      }`}>
                        {submitted && isThisCorrect ? '✓' :
                         submitted && isSelected && !isThisCorrect ? '✗' :
                         isSelected ? '•' : ''}
                      </span>
                      <span className={submitted && isThisCorrect ? 'text-emerald-300' : submitted && isSelected && !isThisCorrect ? 'text-red-300' : 'text-white/80'}>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Explanation (shown after submit) */}
              {submitted && q.explanation && (
                <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                  <span className="text-xs shrink-0 mt-0.5">💡</span>
                  <p className="text-xs text-white/55 leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit bar */}
      {!submitted && (
        <div className="px-4 py-3 border-t border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">{answered} of {questions.length} answered</span>
            <span className="text-xs text-white/40">{questions.length - answered} remaining</span>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }} />
          </div>
          <button
            disabled={answered < questions.length || submitting}
            onClick={submitQuiz}
            className="w-full py-2.5 rounded-xl bg-purple-500/20 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? '⏳ Saving…' : answered < questions.length
              ? `Answer all ${questions.length - answered} remaining question${questions.length - answered !== 1 ? 's' : ''}`
              : '🧠 Submit quiz'}
          </button>
        </div>
      )}
    </div>
  );
}
