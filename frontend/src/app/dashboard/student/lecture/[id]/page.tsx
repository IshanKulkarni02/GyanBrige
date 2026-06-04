'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authFetch } from '@/lib/api';
import { toast } from 'sonner';

interface Chapter { startSec: number; title: string; }
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
  const router   = useRouter();
  const params   = useParams();
  const lectureId = params.id as string;

  const [user, setUser]       = useState<UserData | null>(null);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [course, setCourse]   = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'notes' | 'chapters'>('chapters');
  const [completed, setCompleted] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime]     = useState(0);
  const [activeChapter, setActiveChapter] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const parsed = JSON.parse(stored);
    if (parsed.role !== 'student') { router.push('/login'); return; }
    setUser(parsed);
    loadLecture();
  }, [router, lectureId]);

  // Update active chapter as video plays
  useEffect(() => {
    if (!lecture?.chapters?.length) return;
    const idx = [...lecture.chapters].reverse().findIndex(c => c.startSec <= currentTime);
    if (idx !== -1) setActiveChapter(lecture.chapters.length - 1 - idx);
  }, [currentTime, lecture]);

  const loadLecture = async () => {
    try {
      const res  = await authFetch(`/api/lectures/${lectureId}`);
      const data = await res.json();
      setLecture(data.lecture);
      if (data.lecture?.courseId) {
        const cr   = await authFetch(`/api/courses/${data.lecture.courseId}`);
        const cd   = await cr.json();
        setCourse(cd.course);
      }
    } catch { toast.error('Failed to load lecture'); }
    finally  { setLoading(false); }
  };

  const seekToChapter = (ch: Chapter) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = ch.startSec;
    videoRef.current.play();
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="glass border-b border-white/10 p-4 shrink-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href={course ? `/dashboard/student/course/${course.id}` : '/dashboard/student'} className="text-white/60 hover:text-white">← Back</Link>
            {course && <div className="flex items-center gap-2"><span className="text-xl">{course.icon}</span><span className="text-white/60 hidden sm:block">{course.name}</span></div>}
          </div>
          <div className="flex items-center gap-3">
            {!completed
              ? <button onClick={markAsComplete} className="btn-primary px-4 py-2 text-sm">✓ Mark Complete</button>
              : <span className="text-emerald-400 text-sm flex items-center gap-1">✅ Completed</span>
            }
          </div>
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
                onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={e => setVideoDuration(e.currentTarget.duration)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <div className="text-center"><span className="text-5xl block mb-3">🎬</span><p>No video for this lecture</p></div>
              </div>
            )}

            {/* Chapter markers on scrubber overlay */}
            {chapters.length > 1 && videoDuration > 0 && (
              <div className="absolute bottom-[52px] left-0 right-0 h-1 pointer-events-none px-3">
                {chapters.slice(1).map((ch, i) => (
                  <div
                    key={i}
                    className="absolute top-0 w-0.5 h-full bg-white/60 rounded"
                    style={{ left: `${(ch.startSec / videoDuration) * 100}%` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Title + info */}
          <div className="p-5">
            <h1 className="text-xl font-bold mb-1">{lecture.title}</h1>
            <p className="text-white/50 text-sm mb-3">{lecture.description}</p>

            {/* Active chapter badge */}
            {chapters.length > 0 && (
              <div className="inline-flex items-center gap-2 glass px-3 py-1.5 rounded-full text-sm">
                <span className="text-emerald-400">▶</span>
                <span className="text-white/80">{chapters[activeChapter]?.title}</span>
                {videoDuration > 0 && <span className="text-white/40">{fmtTime(currentTime)}</span>}
              </div>
            )}
          </div>

          {/* Mobile tab switcher */}
          <div className="lg:hidden flex border-t border-white/10">
            {chapters.length > 0 && (
              <button onClick={() => setTab('chapters')} className={`flex-1 py-3 text-sm font-medium ${tab === 'chapters' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-white/50'}`}>
                🔖 Chapters ({chapters.length})
              </button>
            )}
            <button onClick={() => setTab('notes')} className={`flex-1 py-3 text-sm font-medium ${tab === 'notes' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-white/50'}`}>
              📝 Notes
            </button>
          </div>

          {/* Mobile panel */}
          <div className="lg:hidden overflow-y-auto">
            {tab === 'chapters' && chapters.length > 0 && (
              <ChapterList chapters={chapters} activeChapter={activeChapter} onSeek={seekToChapter} videoDuration={videoDuration} />
            )}
            {tab === 'notes' && <NotesPanel notes={lecture.notes} />}
          </div>
        </div>

        {/* ── Right panel (desktop) ── */}
        <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col border-l border-white/10 bg-black/30 shrink-0">
          {/* Tab bar */}
          <div className="flex border-b border-white/10 shrink-0">
            {chapters.length > 0 && (
              <button onClick={() => setTab('chapters')} className={`flex-1 py-3 text-sm font-medium transition ${tab === 'chapters' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-white/40 hover:text-white/70'}`}>
                🔖 Chapters
              </button>
            )}
            <button onClick={() => setTab('notes')} className={`flex-1 py-3 text-sm font-medium transition ${tab === 'notes' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-white/40 hover:text-white/70'}`}>
              📝 Notes
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === 'chapters' && chapters.length > 0 && (
              <ChapterList chapters={chapters} activeChapter={activeChapter} onSeek={seekToChapter} videoDuration={videoDuration} />
            )}
            {(tab === 'notes' || chapters.length === 0) && <NotesPanel notes={lecture.notes} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Chapter list component ────────────────────────────────────────────────────

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
          <button
            key={i}
            onClick={() => onSeek(ch)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${isActive ? 'bg-emerald-500/10' : ''}`}
          >
            {/* Chapter number */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isActive ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50'}`}>
              {i + 1}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isActive ? 'text-emerald-400' : 'text-white/80'}`}>{ch.title}</p>
              <p className="text-xs text-white/40 mt-0.5">
                {fmtTime(ch.startSec)}
                {duration ? <span className="ml-1">· {Math.round(duration / 60)} min</span> : null}
              </p>
            </div>

            {isActive && <span className="text-emerald-400 text-xs shrink-0">▶ Now</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Notes panel component ─────────────────────────────────────────────────────

function NotesPanel({ notes }: { notes: string }) {
  if (!notes) return (
    <div className="p-6 text-center">
      <span className="text-4xl block mb-3">📝</span>
      <p className="text-white/40 text-sm">No notes for this lecture.</p>
    </div>
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
