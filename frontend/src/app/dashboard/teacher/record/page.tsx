'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Course {
  id: string;
  name: string;
  icon: string;
}

interface UserData {
  id: string;
  name: string;
  role: string;
}

export default function RecordLecturePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingType, setRecordingType] = useState<'audio' | 'video'>('audio');
  
  // Form state
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'teacher') {
        router.push('/login');
      } else {
        setUser(parsed);
        loadCourses(parsed.id);
      }
    } else {
      router.push('/login');
    }

    return () => {
      // Cleanup
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [router]);

  const loadCourses = async (teacherId: string) => {
    try {
      const res = await fetch(`/api/courses?teacherId=${teacherId}`);
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const constraints = recordingType === 'video' 
        ? { video: true, audio: true }
        : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (recordingType === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      
      const mimeType = recordingType === 'video' ? 'video/webm' : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }
      };
      
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      setError('Failed to access microphone/camera. Please grant permissions.');
      console.error('Recording error:', err);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setIsPaused(!isPaused);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const discardRecording = () => {
    setRecordedBlob(null);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const saveRecording = async () => {
    if (!recordedBlob || !title || !courseId) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Upload the recording
      const formData = new FormData();
      const extension = recordingType === 'video' ? 'webm' : 'webm';
      const filename = `recording-${Date.now()}.${extension}`;
      formData.append('file', recordedBlob, filename);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      
      const uploadData = await uploadRes.json();

      // Create the lecture
      const lectureRes = await fetch('/api/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: `Recorded ${recordingType} lecture`,
          courseId,
          duration: Math.ceil(recordingTime / 60),
          notes,
          videoUrl: uploadData.url,
        }),
      });

      if (!lectureRes.ok) throw new Error('Failed to create lecture');

      setSuccess(true);
      setTimeout(() => router.push('/dashboard/teacher'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🎙️</div>
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center glass rounded-2xl p-8">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">Lecture Saved!</h2>
          <p className="text-white/60">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Back Button */}
      <Link 
        href="/dashboard/teacher" 
        className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition"
      >
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🎙️ Record Lecture</h1>
        <p className="text-white/60">Record audio or video lectures directly from your browser</p>
      </div>

      <div className="max-w-2xl">
        {/* Recording Type Selection */}
        {!isRecording && !recordedBlob && (
          <div className="glass rounded-2xl p-6 mb-6">
            <label className="block text-sm text-white/70 mb-3">Recording Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setRecordingType('audio')}
                className={`p-4 rounded-xl border-2 transition ${
                  recordingType === 'audio'
                    ? 'border-emerald-500 bg-emerald-500/20'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <span className="text-3xl block mb-2">🎤</span>
                <span className="font-medium">Audio Only</span>
                <p className="text-white/50 text-sm">Record voice narration</p>
              </button>
              <button
                onClick={() => setRecordingType('video')}
                className={`p-4 rounded-xl border-2 transition ${
                  recordingType === 'video'
                    ? 'border-emerald-500 bg-emerald-500/20'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <span className="text-3xl block mb-2">📹</span>
                <span className="font-medium">Video</span>
                <p className="text-white/50 text-sm">Record with camera</p>
              </button>
            </div>
          </div>
        )}

        {/* Recording Area */}
        <div className="glass rounded-2xl p-8 mb-6">
          {/* Video Preview */}
          {recordingType === 'video' && (isRecording || recordedBlob) && (
            <div className="mb-6 rounded-xl overflow-hidden bg-black">
              {isRecording && (
                <video 
                  ref={videoPreviewRef} 
                  className="w-full aspect-video"
                  muted
                  playsInline
                />
              )}
              {recordedBlob && !isRecording && (
                <video 
                  src={URL.createObjectURL(recordedBlob)} 
                  className="w-full aspect-video"
                  controls
                />
              )}
            </div>
          )}

          {/* Audio Playback */}
          {recordingType === 'audio' && recordedBlob && !isRecording && (
            <div className="mb-6">
              <audio 
                src={URL.createObjectURL(recordedBlob)} 
                controls 
                className="w-full"
              />
            </div>
          )}

          {/* Recording Status */}
          <div className="text-center mb-6">
            {isRecording ? (
              <>
                <div className={`text-6xl mb-4 ${isPaused ? '' : 'animate-pulse'}`}>
                  {isPaused ? '⏸️' : '🔴'}
                </div>
                <div className="text-4xl font-mono mb-2">{formatTime(recordingTime)}</div>
                <p className="text-white/60">
                  {isPaused ? 'Recording Paused' : 'Recording...'}
                </p>
              </>
            ) : recordedBlob ? (
              <>
                <div className="text-6xl mb-4">✅</div>
                <div className="text-2xl font-mono mb-2">{formatTime(recordingTime)}</div>
                <p className="text-white/60">Recording Complete</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">{recordingType === 'video' ? '📹' : '🎤'}</div>
                <p className="text-white/60">Ready to record</p>
              </>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4">
            {!isRecording && !recordedBlob && (
              <button
                onClick={startRecording}
                className="btn-primary px-8 py-4 text-lg flex items-center gap-2"
              >
                <span className="text-xl">⏺️</span> Start Recording
              </button>
            )}
            
            {isRecording && (
              <>
                <button
                  onClick={pauseRecording}
                  className="glass px-6 py-4 rounded-xl hover:bg-white/10 transition"
                >
                  {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>
                <button
                  onClick={stopRecording}
                  className="bg-red-500 px-6 py-4 rounded-xl hover:bg-red-600 transition"
                >
                  ⏹️ Stop
                </button>
              </>
            )}
            
            {recordedBlob && !isRecording && (
              <>
                <button
                  onClick={discardRecording}
                  className="glass px-6 py-4 rounded-xl hover:bg-red-500/20 transition text-red-400"
                >
                  🗑️ Discard
                </button>
                <button
                  onClick={startRecording}
                  className="glass px-6 py-4 rounded-xl hover:bg-white/10 transition"
                >
                  🔄 Re-record
                </button>
              </>
            )}
          </div>
        </div>

        {/* Save Form */}
        {recordedBlob && !isRecording && (
          <div className="glass rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold mb-4">💾 Save Recording</h3>
            
            <div>
              <label className="block text-sm text-white/70 mb-2">Course *</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="input-glass"
                required
              >
                <option value="">Select a course...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.icon} {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Lecture Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-glass"
                placeholder="e.g., Introduction to Calculus"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-glass min-h-[100px] resize-none"
                placeholder="Add lecture notes..."
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={saveRecording}
              disabled={saving || !title || !courseId}
              className="btn-primary w-full py-4 text-lg disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Saving...
                </span>
              ) : (
                '💾 Save Lecture'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
