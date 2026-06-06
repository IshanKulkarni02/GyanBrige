'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';
import dynamic from 'next/dynamic';

const LiveStreamBroadcaster = dynamic(() => import('@/components/LiveStreamBroadcaster'), { ssr: false });

interface Course   { id: string; name: string; icon: string; }
interface UserData { id: string; name: string; role: string; }

type PageState = 'setup' | 'live' | 'done';

export default function TeacherLivePage() {
  const router = useRouter();

  const [user,      setUser]      = useState<UserData | null>(null);
  const [courses,   setCourses]   = useState<Course[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Form
  const [title,     setTitle]     = useState('');
  const [courseId,  setCourseId]  = useState('');
  const [creating,  setCreating]  = useState(false);
  const [formError, setFormError] = useState('');

  // Page state
  const [page,       setPage]       = useState<PageState>('setup');
  const [lectureId,  setLectureId]  = useState('');
  const [savedUrl,   setSavedUrl]   = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed: UserData;
    try { parsed = JSON.parse(stored); } catch {
      localStorage.removeItem('user'); router.push('/login'); return;
    }
    if (parsed.role !== 'teacher') { router.push('/login'); return; }
    setUser(parsed);

    authFetch(`/api/courses?teacherId=${parsed.id}`)
      .then(r => r.json())
      .then((d: { courses?: Course[] }) => setCourses(d.courses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  // Step 1: create the lecture shell, then open broadcaster
  const handleStart = useCallback(async () => {
    if (!title.trim()) { setFormError('Enter a lecture title'); return; }
    if (!courseId)     { setFormError('Select a course');       return; }
    setFormError('');
    setCreating(true);
    try {
      const res = await authFetch('/api/lectures', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          courseId,
          description: 'Recorded from live stream',
          duration: 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to create lecture');
      }
      const { lecture } = await res.json() as { lecture: { id: string } };
      setLectureId(lecture.id);
      setPage('live');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create lecture');
    } finally {
      setCreating(false);
    }
  }, [title, courseId]);

  // Called by broadcaster when the recording has been uploaded + lecture updated
  const handleRecordingSaved = useCallback((videoUrl: string) => {
    setSavedUrl(videoUrl);
    setPage('done');
  }, []);

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="glass border-b border-white/10 p-4 shrink-0">
        <div className="flex items-center gap-4 max-w-3xl mx-auto">
          <Link href="/dashboard/teacher" className="text-white/60 hover:text-white">← Dashboard</Link>
          <div className="flex items-center gap-2">
            {page === 'live' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            <h1 className="font-semibold">
              {page === 'setup' ? 'Go Live'         :
               page === 'live'  ? 'Live Now'        :
               'Lecture Saved'}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full p-5 space-y-5">

        {/* ── SETUP ── */}
        {page === 'setup' && (
          <>
            <div className="glass rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="font-semibold mb-1">New Live Lecture</h2>
                <p className="text-sm text-white/50">
                  Give your lecture a title and pick the course. The live stream will be automatically saved as a recorded lecture when you end it.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Lecture title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStart()}
                    placeholder="e.g. Introduction to Calculus"
                    className="input-glass w-full"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Course</label>
                  {courses.length === 0 ? (
                    <p className="text-sm text-white/40">No courses assigned to you yet.</p>
                  ) : (
                    <select
                      value={courseId}
                      onChange={e => setCourseId(e.target.value)}
                      className="input-glass w-full"
                    >
                      <option value="">— Select course —</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {formError && <p className="text-sm text-red-400">{formError}</p>}

              <button
                onClick={handleStart}
                disabled={creating || courses.length === 0}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creating
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating lecture…</>
                  : '🔴 Start Live Stream'}
              </button>
            </div>

            <div className="glass rounded-xl p-5 space-y-2">
              <h3 className="text-sm font-semibold text-white/60 mb-3">How it works</h3>
              {[
                ['🎬', 'A lecture is created immediately when you click Start'],
                ['📡', 'Students on that lecture\'s page will see a "Teacher is live" banner and can join'],
                ['🎙️', 'Your camera and microphone are recorded throughout the stream'],
                ['💾', 'When you click "End & Save", the recording is uploaded and attached to the lecture automatically'],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-start gap-2 text-sm text-white/45">
                  <span className="shrink-0">{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── LIVE ── */}
        {page === 'live' && lectureId && (
          <LiveStreamBroadcaster
            lectureId={lectureId}
            userId={user.id}
            onStreamStart={() => {}}
            onStreamEnd={() => {}}
            onRecordingSaved={handleRecordingSaved}
          />
        )}

        {/* ── DONE ── */}
        {page === 'done' && (
          <div className="glass rounded-2xl p-8 text-center space-y-5">
            <div className="text-5xl">🎉</div>
            <div>
              <h2 className="text-xl font-bold mb-2">Lecture saved!</h2>
              <p className="text-white/55 text-sm">
                <span className="font-medium text-white/80">{title}</span> has been saved as a recorded lecture.
                Students can now watch the recording.
              </p>
            </div>

            {savedUrl && (
              <div className="glass rounded-xl p-3 text-xs text-white/40 font-mono break-all">{savedUrl}</div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/dashboard/teacher/course/${courseId}`}
                className="btn-primary px-6 py-2.5"
              >
                View Lecture →
              </Link>
              <button
                onClick={() => { setPage('setup'); setTitle(''); setCourseId(''); setLectureId(''); setSavedUrl(''); }}
                className="glass px-6 py-2.5 rounded-xl text-white/70 hover:text-white transition"
              >
                Go Live Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
