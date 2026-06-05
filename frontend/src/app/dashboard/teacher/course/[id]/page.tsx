'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authFetch } from '@/lib/api';
import { toast } from 'sonner';

interface Lecture  { id: string; title: string; description: string; duration: number; order: number; videoUrl?: string; notes: string; chapters?: {startSec:number;title:string}[]; segments?: {start:number;end:number;text:string}[]; }
interface Student  { id: string; name: string; email: string; progress: number; completedLectures: string[]; }
interface Course   { id: string; name: string; description: string; icon: string; color: string; }
interface UserData { id: string; name: string; role: string; }
interface Quiz     { id: string; title: string; questions?: {id:string}[]; }

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
  const [deleting, setDeleting] = useState<string | null>(null);

  // Notes editor state
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [editedNotes,    setEditedNotes]    = useState('');
  const [savingNotes,    setSavingNotes]    = useState(false);
  const [regenNotes,     setRegenNotes]     = useState(false);
  // "also generate" toggles
  const [alsoChapters,   setAlsoChapters]   = useState(false);
  const [alsoQuiz,       setAlsoQuiz]       = useState(false);
  const [alsoQuizCount,  setAlsoQuizCount]  = useState(5);

  // Real-time generation progress
  interface ProgressStage { key: string; icon: string; label: string; status: 'pending'|'running'|'done'|'error'; detail: string; }
  const [regenPct,     setRegenPct]     = useState(0);
  const [regenStages,  setRegenStages]  = useState<ProgressStage[]>([]);
  const [regenMsg,     setRegenMsg]     = useState('');
  const [regenDetail,  setRegenDetail]  = useState('');
  const [regenElapsed, setRegenElapsed] = useState(0);
  const regenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quiz state
  const [quizModal,      setQuizModal]      = useState<string | null>(null); // lectureId
  const [quizTitle,      setQuizTitle]      = useState('');
  const [quizCount,      setQuizCount]      = useState(5);
  const [creatingQuiz,   setCreatingQuiz]   = useState(false);
  const [lectureQuizzes, setLectureQuizzes] = useState<Record<string, Quiz[]>>({});

  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Cleanup regen timer on unmount to prevent memory leak
  useEffect(() => {
    return () => { if (regenTimerRef.current) clearInterval(regenTimerRef.current); };
  }, []);

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
      const { course }      = await courseRes.json();
      const { lectures }    = await lecturesRes.json();
      const { enrollments } = await enrollmentsRes.json();

      setCourse(course);
      const lecs = lectures ?? [];
      setLectures(lecs);
      setStudents((enrollments ?? []).map((e: { userId:string; userName:string; userEmail:string; progress:number; completedLectures:string[] }) => ({
        id: e.userId, name: e.userName, email: e.userEmail,
        progress: e.progress, completedLectures: e.completedLectures,
      })));

      // Load quizzes for each lecture
      const quizMap: Record<string, Quiz[]> = {};
      await Promise.all(lecs.map(async (l: Lecture) => {
        const r = await authFetch(`/api/quizzes?lectureId=${l.id}`);
        const d = await r.json();
        quizMap[l.id] = d.quizzes ?? [];
      }));
      setLectureQuizzes(quizMap);
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
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setDeleting(null); }
  };

  // ── Notes editor ────────────────────────────────────────────────────────────

  const openNotesEditor = (lec: Lecture) => {
    setEditingLecture(lec);
    setEditedNotes(lec.notes || '');
    setTimeout(() => notesRef.current?.focus(), 100);
  };

  const saveNotes = async () => {
    if (!editingLecture) return;
    setSavingNotes(true);
    try {
      const res = await authFetch(`/api/lectures/${editingLecture.id}`, {
        method: 'PUT',
        body: JSON.stringify({ notes: editedNotes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setLectures(prev => prev.map(l => l.id === editingLecture.id ? { ...l, notes: editedNotes } : l));
      setEditingLecture(null);
      toast.success('Notes saved');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSavingNotes(false); }
  };

  const regenerateNotes = async () => {
    if (!editingLecture) return;

    // Build initial stage list based on what was requested
    const initialStages: ProgressStage[] = [];
    const hasVideo = !editingLecture.segments?.length && !!editingLecture.videoUrl;
    if (hasVideo) {
      initialStages.push({ key: 'extract',  icon: '🎬', label: 'Extract audio',    status: 'pending', detail: '' });
      initialStages.push({ key: 'whisper',  icon: '🎙️', label: 'Transcribe audio', status: 'pending', detail: '' });
    }
    initialStages.push({ key: 'notes',    icon: '✏️', label: 'Generate notes',    status: 'pending', detail: '' });
    if (alsoChapters) initialStages.push({ key: 'chapters', icon: '🔖', label: 'Detect bookmarks', status: 'pending', detail: '' });
    if (alsoQuiz)     initialStages.push({ key: 'quiz',     icon: '🧠', label: 'Create quiz',      status: 'pending', detail: '' });

    setRegenNotes(true);
    setRegenPct(2);
    setRegenStages(initialStages);
    setRegenMsg('Starting…');
    setRegenDetail('');
    setRegenElapsed(0);

    // Elapsed-time counter
    const startTime = Date.now();
    regenTimerRef.current = setInterval(() => {
      setRegenElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const setStage = (key: string, status: ProgressStage['status'], detail?: string) => {
      setRegenStages(prev => prev.map(s => s.key === key ? { ...s, status, detail: detail ?? s.detail } : s));
    };

    try {
      const res = await authFetch(`/api/lectures/${editingLecture.id}/generate-all`, {
        method: 'POST',
        body: JSON.stringify({
          generateNotes:  true,
          detectChapters: alsoChapters,
          generateQuiz:   alsoQuiz,
          quizTitle:      `Quiz: ${editingLecture.title}`,
          quizCount:      alsoQuizCount,
        }),
      });

      // Non-streaming error (auth, validation)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        throw new Error(err.error || 'Generation failed');
      }

      // Read SSE stream
      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }

          const msg    = (ev.msg    as string) || '';
          const detail = (ev.detail as string) || '';
          const pct    = (ev.pct    as number) || 0;

          if (pct)    setRegenPct(pct);
          if (msg)    setRegenMsg(msg);
          if (detail) setRegenDetail(detail);

          switch (ev.type) {
            // ── Transcript stages ──────────────────────────────────────────
            case 'transcript_cached':
              setStage('extract',  'done', 'Cached');
              setStage('whisper',  'done', detail);
              break;
            case 'extract_start':
              setStage('extract', 'running', detail);
              break;
            case 'extract_done':
              setStage('extract', 'done', detail);
              break;
            case 'whisper_start':
              setStage('whisper', 'running', detail);
              break;
            case 'whisper_chunk':
              setStage('whisper', 'running', `Part ${ev.part} of ${ev.total}`);
              break;
            case 'whisper_done':
              setStage('whisper', 'done', detail);
              break;
            // ── AI stages ─────────────────────────────────────────────────
            case 'notes_start':
              setStage('notes', 'running', detail);
              break;
            case 'notes_done':
              setStage('notes', 'done', detail);
              break;
            case 'chapters_start':
              setStage('chapters', 'running', detail);
              break;
            case 'chapters_done':
              setStage('chapters', 'done', detail);
              break;
            case 'quiz_start':
              setStage('quiz', 'running', detail);
              break;
            case 'quiz_done':
              setStage('quiz', 'done', detail);
              break;
            // ── Final ─────────────────────────────────────────────────────
            case 'complete': {
              const data = ev;
              if (data.notes)    setEditedNotes(data.notes as string);
              if (data.chapters) setLectures(prev => prev.map(l =>
                l.id === editingLecture.id ? { ...l, chapters: data.chapters as typeof l.chapters } : l
              ));
              if (data.quiz) setLectureQuizzes(prev => ({
                ...prev,
                [editingLecture.id]: [...(prev[editingLecture.id] ?? []), data.quiz as Quiz],
              }));
              const summaryParts = ['Done'];
              if (data.transcriptSource === 'video') summaryParts.push('transcript saved');
              if (data.chapters) summaryParts.push(`${(data.chapters as unknown[]).length} chapters`);
              if (data.quiz)     summaryParts.push(`quiz (${(data.quiz as {questions?:unknown[]}).questions?.length ?? 0} Qs)`);
              toast.success(summaryParts.join(' · ') + ' ✓');
              if (data.notesError)    toast.error(`Notes: ${data.notesError}`);
              if (data.chaptersError) toast.error(`Chapters: ${data.chaptersError}`);
              if (data.quizError)     toast.error(`Quiz: ${data.quizError}`);
              break;
            }
            case 'error':
              throw new Error(ev.msg as string || 'Generation failed');
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
      setRegenStages(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s));
    } finally {
      if (regenTimerRef.current) clearInterval(regenTimerRef.current);
      setRegenNotes(false);
    }
  };

  // ── Quiz builder ─────────────────────────────────────────────────────────────

  const openQuizModal = (lectureId: string, lectureTitle: string) => {
    setQuizModal(lectureId);
    setQuizTitle(`Quiz: ${lectureTitle}`);
    setQuizCount(5);
  };

  const createQuiz = async (generateAI: boolean) => {
    if (!quizModal || !quizTitle.trim()) return;
    setCreatingQuiz(true);
    try {
      const res = await authFetch('/api/quizzes', {
        method: 'POST',
        body: JSON.stringify({ lectureId: quizModal, courseId, title: quizTitle, generateAI, questionCount: quizCount }),
      });
      const data = await res.json();
      if (!res.ok && !data.quiz) throw new Error(data.error);
      if (data.aiError) toast.warning(`Quiz created but AI failed: ${data.aiError}. Add questions manually.`);
      else if (generateAI) toast.success(`Quiz created with ${data.quiz.questions?.length ?? 0} AI questions!`);
      else toast.success('Quiz created — add questions manually');

      setLectureQuizzes(prev => ({ ...prev, [quizModal]: [...(prev[quizModal] ?? []), data.quiz] }));
      setQuizModal(null);

      // Navigate to quiz builder
      router.push(`/dashboard/teacher/quiz/${data.quiz.id}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to create quiz'); }
    finally { setCreatingQuiz(false); }
  };

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4 animate-pulse">📚</div><p className="text-white/60">Loading...</p></div>
    </div>
  );
  if (!course) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">❌</div><p className="text-white/60">Course not found</p>
        <Link href="/dashboard/teacher" className="text-emerald-400 mt-4 inline-block">← Dashboard</Link>
      </div>
    </div>
  );

  const avgProgress = students.length ? Math.round(students.reduce((s, st) => s + st.progress, 0) / students.length) : 0;

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <Link href="/dashboard/teacher" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">← Dashboard</Link>

      {/* Course header */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${course.color} flex items-center justify-center text-3xl shrink-0`}>{course.icon}</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold mb-1">{course.name}</h1>
            <p className="text-white/60">{course.description}</p>
          </div>
          <Link href={`/dashboard/teacher/upload`} className="btn-primary px-4 py-2 text-sm shrink-0">+ Add Lecture</Link>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: 'Lectures',     value: lectures.length, icon: '🎬' },
            { label: 'Students',     value: students.length, icon: '🎓' },
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
              <Link href="/dashboard/teacher/upload" className="btn-primary px-6 py-3">Upload First Lecture</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {lectures.map((lec) => {
                const quizList = lectureQuizzes[lec.id] ?? [];
                return (
                  <div key={lec.id} className="glass rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/50 text-sm shrink-0">{lec.order}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{lec.title}</h4>
                        <p className="text-white/40 text-xs mt-0.5">
                          {lec.duration} min
                          {lec.videoUrl && <span className="ml-2 text-emerald-400">● Video</span>}
                          {lec.notes    && <span className="ml-2 text-purple-400">● Notes</span>}
                          {lec.chapters?.length ? <span className="ml-2 text-blue-400">● {lec.chapters.length} chapters</span> : null}
                          {quizList.length > 0 && <span className="ml-2 text-amber-400">● {quizList.length} quiz{quizList.length > 1 ? 'zes' : ''}</span>}
                        </p>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => openNotesEditor(lec)}
                          className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition text-xs">
                          ✏️ Notes
                        </button>
                        <button onClick={() => openQuizModal(lec.id, lec.title)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition text-xs">
                          🧠 Quiz
                        </button>
                        {quizList.map(q => (
                          <Link key={q.id} href={`/dashboard/teacher/quiz/${q.id}`}
                            className="px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition text-xs">
                            {q.title}
                          </Link>
                        ))}
                        <button onClick={() => deleteLecture(lec.id)} disabled={deleting === lec.id}
                          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Students tab */}
      {tab === 'students' && (
        <div>
          {students.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center"><span className="text-4xl block mb-3">🎓</span><p className="text-white/50">No students enrolled yet</p></div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              {students.map((st, i) => (
                <div key={st.id} className={`flex items-center gap-4 p-4 ${i !== students.length - 1 ? 'border-b border-white/10' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"><span>🎓</span></div>
                  <div className="flex-1 min-w-0"><p className="font-medium">{st.name}</p><p className="text-white/40 text-xs">{st.email}</p></div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${st.progress === 100 ? 'text-emerald-400' : 'text-white'}`}>{st.progress}%</p>
                    <p className="text-white/30 text-xs">{st.completedLectures.length}/{lectures.length} lectures</p>
                  </div>
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                    <div className={`h-full bg-gradient-to-r ${course.color}`} style={{ width: `${st.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Notes editor modal ─────────────────────────────────────────────── */}
      {editingLecture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditingLecture(null)}>
          <div className="w-full max-w-2xl glass rounded-2xl p-6 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-semibold">✏️ {editingLecture.title} — Notes</h2>
              <button onClick={() => setEditingLecture(null)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>

            {/* Source indicator */}
            <div className="mb-3 text-xs">
              {editingLecture.segments?.length
                ? <span className="text-emerald-400">✓ transcript stored — instant regeneration</span>
                : editingLecture.videoUrl
                  ? <span className="text-blue-400">📹 no transcript yet — will auto-transcribe from video</span>
                  : <span className="text-white/40">no video — notes from title only</span>}
            </div>

            {/* Also generate checkboxes */}
            <div className="glass rounded-xl p-3 mb-3 space-y-2.5">
              <p className="text-xs text-white/50 mb-1">Generate together to save AI credits — one transcription, all at once:</p>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked className="accent-emerald-500" readOnly />
                <span className="text-sm text-white/80">✏️ Regenerate Notes</span>
                <span className="text-xs text-white/30">(always included)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={alsoChapters} onChange={e => setAlsoChapters(e.target.checked)} className="accent-blue-500" />
                <span className="text-sm text-white/80">🔖 Detect Chapter Bookmarks</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={alsoQuiz} onChange={e => setAlsoQuiz(e.target.checked)} className="accent-amber-500" />
                <span className="text-sm text-white/80">🧠 Generate Quiz</span>
                {alsoQuiz && (
                  <select value={alsoQuizCount} onChange={e => setAlsoQuizCount(Number(e.target.value))}
                    className="ml-1 bg-white/10 text-white/70 rounded-lg px-2 py-0.5 text-xs border border-white/10">
                    {[3,5,8,10].map(n => <option key={n} value={n}>{n} questions</option>)}
                  </select>
                )}
              </label>
            </div>

            <button onClick={regenerateNotes} disabled={regenNotes}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50 transition text-sm mb-3 w-full justify-center">
              {regenNotes
                ? <><span className="animate-spin inline-block">⚙️</span> Generating…</>
                : `🤖 Generate${alsoChapters || alsoQuiz ? ' All' : ' Notes'}`}
            </button>

            {/* ── Real-time progress panel ───────────────────────────────── */}
            {regenNotes && regenStages.length > 0 && (
              <div className="mb-3 p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                {/* Headline */}
                <div>
                  <p className="text-sm font-medium text-white/90">{regenMsg}</p>
                  {regenDetail && <p className="text-xs text-white/45 mt-0.5">{regenDetail}</p>}
                </div>

                {/* Progress bar */}
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${regenPct}%` }}
                  />
                </div>

                {/* Percentage + elapsed */}
                <div className="flex justify-between text-xs text-white/35">
                  <span>{regenPct}%</span>
                  <span>
                    {regenElapsed >= 60
                      ? `${Math.floor(regenElapsed / 60)}m ${regenElapsed % 60}s`
                      : `${regenElapsed}s`} elapsed
                  </span>
                </div>

                {/* Stage list */}
                <div className="space-y-1.5 pt-1 border-t border-white/8">
                  {regenStages.map(stage => (
                    <div key={stage.key} className="flex items-start gap-2 text-xs">
                      <span className={`mt-0.5 shrink-0 ${
                        stage.status === 'done'    ? 'text-emerald-400' :
                        stage.status === 'running' ? 'text-purple-400'  :
                        stage.status === 'error'   ? 'text-red-400'     :
                        'text-white/20'
                      }`}>
                        {stage.status === 'done'    ? '✓' :
                         stage.status === 'running' ? '◉' :
                         stage.status === 'error'   ? '✗' : '○'}
                      </span>
                      <span className={stage.status === 'pending' ? 'text-white/30' : 'text-white/80'}>
                        {stage.icon} {stage.label}
                      </span>
                      {stage.detail && (
                        <span className="text-white/35 ml-auto shrink-0">{stage.detail}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              ref={notesRef}
              value={editedNotes}
              onChange={e => setEditedNotes(e.target.value)}
              className="input-glass flex-1 min-h-[300px] font-mono text-sm resize-none"
              placeholder="# Topic 1&#10;&#10;- Key point&#10;- Key point"
            />

            <div className="flex gap-3 mt-4 shrink-0">
              <button onClick={saveNotes} disabled={savingNotes}
                className="btn-primary flex-1 py-3 disabled:opacity-50">
                {savingNotes ? '⏳ Saving…' : '💾 Save Notes'}
              </button>
              <button onClick={() => setEditingLecture(null)} className="glass px-6 py-3 rounded-xl hover:bg-white/10 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quiz creation modal ────────────────────────────────────────────── */}
      {quizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setQuizModal(null)}>
          <div className="w-full max-w-md glass rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">🧠 Create Quiz</h2>
              <button onClick={() => setQuizModal(null)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Quiz Title</label>
                <input value={quizTitle} onChange={e => setQuizTitle(e.target.value)} className="input-glass" />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Number of AI Questions</label>
                <select value={quizCount} onChange={e => setQuizCount(Number(e.target.value))} className="input-glass">
                  {[3,5,8,10,15].map(n => <option key={n} value={n}>{n} questions</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button onClick={() => createQuiz(false)} disabled={creatingQuiz || !quizTitle.trim()}
                className="glass py-3 rounded-xl hover:bg-white/10 transition disabled:opacity-50 text-sm">
                ✍️ Manual
                <p className="text-white/40 text-xs mt-0.5">Add questions yourself</p>
              </button>
              <button onClick={() => createQuiz(true)} disabled={creatingQuiz || !quizTitle.trim()}
                className="btn-primary py-3 disabled:opacity-50 text-sm">
                {creatingQuiz ? <><span className="animate-spin block">⚙️</span></> : <>🤖 AI Generate<p className="text-white/70 text-xs mt-0.5">{quizCount} questions</p></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
