'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Lecture {
  id: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl?: string;
  duration: number;
  notes: string;
  order: number;
}

interface Course {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface UserData {
  id: string;
  name: string;
  role: string;
}

export default function LecturePlayerPage() {
  const router = useRouter();
  const params = useParams();
  const lectureId = params.id as string;
  
  const [user, setUser] = useState<UserData | null>(null);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotes, setShowNotes] = useState(true); // Show notes by default
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'student') {
        router.push('/login');
      } else {
        setUser(parsed);
        loadLecture();
      }
    } else {
      router.push('/login');
    }
  }, [router, lectureId]);

  const loadLecture = async () => {
    try {
      const res = await fetch(`/api/lectures/${lectureId}`);
      const data = await res.json();
      setLecture(data.lecture);
      
      if (data.lecture?.courseId) {
        const courseRes = await fetch(`/api/courses/${data.lecture.courseId}`);
        const courseData = await courseRes.json();
        setCourse(courseData.course);
      }
    } catch (error) {
      console.error('Failed to load lecture:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsComplete = async () => {
    if (!user || !lecture || !course) return;
    
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          courseId: course.id,
          lectureId: lecture.id,
        }),
      });
      setCompleted(true);
    } catch (error) {
      console.error('Failed to mark complete:', error);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🎬</div>
          <p className="text-white/60">Loading lecture...</p>
        </div>
      </div>
    );
  }

  if (!lecture) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-white/60">Lecture not found</p>
          <Link href="/dashboard/student" className="text-emerald-400 mt-4 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="glass border-b border-white/10 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link 
              href={course ? `/dashboard/student/course/${course.id}` : '/dashboard/student'}
              className="text-white/60 hover:text-white transition"
            >
              ← Back
            </Link>
            {course && (
              <div className="flex items-center gap-2">
                <span className="text-xl">{course.icon}</span>
                <span className="text-white/60">{course.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`glass px-4 py-2 rounded-xl transition ${showNotes ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/10'}`}
            >
              📝 Notes
            </button>
            {!completed ? (
              <button
                onClick={markAsComplete}
                className="btn-primary px-4 py-2"
              >
                ✓ Mark Complete
              </button>
            ) : (
              <span className="text-emerald-400 flex items-center gap-2">
                ✅ Completed
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Video Player */}
        <div className={`flex-1 ${showNotes && lecture.notes ? 'lg:w-2/3' : 'w-full'}`}>
          <div className="aspect-video bg-black relative">
            {lecture.videoUrl ? (
              <video
                src={lecture.videoUrl}
                className="w-full h-full"
                controls
                autoPlay={false}
                controlsList="nodownload"
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50">
                <div className="text-center">
                  <span className="text-6xl block mb-4">🎬</span>
                  <p>No video available for this lecture</p>
                  <p className="text-sm mt-2">Check the notes section for content</p>
                </div>
              </div>
            )}
          </div>

          {/* Lecture Info */}
          <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">{lecture.title}</h1>
            <p className="text-white/60 mb-4">{lecture.description}</p>
            
            <div className="flex gap-4 text-sm text-white/50">
              <span>⏱️ {lecture.duration} min</span>
              <span>📑 Lecture {lecture.order}</span>
            </div>

            {/* Mobile Notes */}
            {!showNotes && lecture.notes && (
              <div className="mt-6 lg:hidden">
                <button
                  onClick={() => setShowNotes(true)}
                  className="glass w-full p-4 rounded-xl text-left"
                >
                  <h3 className="font-semibold mb-1">📝 Lecture Notes</h3>
                  <p className="text-white/50 text-sm">Tap to view notes</p>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notes Panel - Always visible on desktop if notes exist */}
        {lecture.notes && (
          <div className={`hidden lg:block w-1/3 border-l border-white/10 h-[calc(100vh-73px)] overflow-y-auto bg-black/30 ${!showNotes ? 'lg:hidden' : ''}`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">🤖 AI-Generated Notes</h2>
                <button
                  onClick={() => setShowNotes(false)}
                  className="text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none space-y-4">
                {lecture.notes.split('\n').map((line, i) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={i} className="text-xl font-bold text-emerald-400 mt-4">{line.slice(2)}</h1>;
                  } else if (line.startsWith('## ')) {
                    return <h2 key={i} className="text-lg font-semibold text-purple-400 mt-3">{line.slice(3)}</h2>;
                  } else if (line.startsWith('### ')) {
                    return <h3 key={i} className="text-base font-medium text-blue-400 mt-2">{line.slice(4)}</h3>;
                  } else if (line.startsWith('- ')) {
                    return <p key={i} className="text-white/80 pl-4">• {line.slice(2)}</p>;
                  } else if (line.startsWith('*') && line.endsWith('*')) {
                    return <p key={i} className="text-white/50 italic text-sm">{line.slice(1, -1)}</p>;
                  } else if (line.trim() === '---') {
                    return <hr key={i} className="border-white/20 my-4" />;
                  } else if (line.trim()) {
                    return <p key={i} className="text-white/70">{line}</p>;
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        )}
        
        {/* No notes message */}
        {!lecture.notes && showNotes && (
          <div className="hidden lg:block w-1/3 border-l border-white/10 h-[calc(100vh-73px)] overflow-y-auto bg-black/30">
            <div className="p-6 text-center">
              <span className="text-4xl block mb-4">📝</span>
              <p className="text-white/50">No notes available for this lecture.</p>
              <p className="text-white/30 text-sm mt-2">Notes are generated when lectures are created.</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Notes Modal */}
      {showNotes && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80" onClick={() => setShowNotes(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-[#0a0a0a] rounded-t-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">📝 Lecture Notes</h2>
                <button
                  onClick={() => setShowNotes(false)}
                  className="text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>
              {lecture.notes ? (
                <pre className="whitespace-pre-wrap font-sans text-white/80 leading-relaxed">
                  {lecture.notes}
                </pre>
              ) : (
                <p className="text-white/50">No notes available for this lecture.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
