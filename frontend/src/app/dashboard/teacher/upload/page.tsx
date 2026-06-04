'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, getStoredUser } from '@/lib/api';
import { toast } from 'sonner';

interface Chapter { startSec: number; title: string; }

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

export default function UploadLecturePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  const [notes, setNotes] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [detectingChapters, setDetectingChapters] = useState(false);
  const [savedLectureId, setSavedLectureId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadSpeed, setUploadSpeed] = useState(0); // MB/s
  const [uploadETA, setUploadETA] = useState<number | null>(null); // seconds
  const [uploadPhase, setUploadPhase] = useState<'uploading' | 'finalizing' | 'done'>('uploading');
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [noteGenStep, setNoteGenStep] = useState(0); // 0: idle, 1: preparing, 2: transcribing, 3: generating, 4: done
  const [noteGenProgress, setNoteGenProgress] = useState(0);
  // AI settings loaded from server (not localStorage)
  const [aiSettings, setAiSettings] = useState<{ useLocalAI: boolean; ollamaModel: string; openaiModel: string; hasOpenaiKey: boolean }>({
    useLocalAI: false, ollamaModel: 'llama3:latest', openaiModel: 'gpt-4o-mini', hasOpenaiKey: false,
  });

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
  }, [router]);

  // Load AI settings from server on mount
  useEffect(() => {
    authFetch('/api/settings').then(r => r.json()).then(d => {
      setAiSettings({
        useLocalAI:   !!d.useLocalAI,
        ollamaModel:  d.ollamaModel  || 'llama3:latest',
        openaiModel:  d.openaiModel  || 'gpt-4o-mini',
        hasOpenaiKey: !!d.hasOpenaiKey,
      });
    }).catch(() => {});
  }, []);

  const loadCourses = async (teacherId: string) => {
    try {
      const res = await authFetch(`/api/courses?teacherId=${teacherId}`);
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const callGenerateNotes = async (): Promise<string> => {
    // AI key + model are read server-side from the settings DB — no need to pass them
    let res: Response;

    if (videoFile && !aiSettings.useLocalAI) {
      // OpenAI path: send video directly, server transcribes + generates
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('audio', videoFile);
      res = await authFetch('/api/generate-notes', { method: 'POST', body: formData });
    } else if (videoFile && aiSettings.useLocalAI) {
      // Ollama path: transcribe with Whisper first, then send transcript
      const audioFormData = new FormData();
      audioFormData.append('file', videoFile);
      const transcribeRes = await authFetch('/api/transcribe', { method: 'POST', body: audioFormData });
      const transcribeData = await transcribeRes.json();
      if (!transcribeData.transcript) {
        throw new Error(transcribeData.error || 'Transcription failed — make sure an OpenAI key is set in Admin → AI Settings.');
      }
      res = await authFetch('/api/generate-notes', {
        method: 'POST',
        body: JSON.stringify({ title, description, transcript: transcribeData.transcript }),
      });
    } else {
      // No video: generate from title + description only
      res = await authFetch('/api/generate-notes', {
        method: 'POST',
        body: JSON.stringify({ title, description }),
      });
    }

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Note generation failed');
    return data.notes as string;
  };

  const detectChapters = async () => {
    if (!videoFile) { toast.error('Select a video first'); return; }
    if (!aiSettings.hasOpenaiKey) {
      toast.error('OpenAI API key not set — go to Admin → AI Settings and save your key');
      return;
    }
    setDetectingChapters(true);
    try {
      const fd = new FormData();
      fd.append('audio', videoFile);
      // Use a temporary lecture endpoint if not yet saved, otherwise patch the real one
      const endpoint = savedLectureId
        ? `/api/lectures/${savedLectureId}/chapters`
        : `/api/lectures/detect-chapters-temp`;
      const res = await authFetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      setChapters(data.chapters);
      toast.success(`${data.chapters.length} chapters detected!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chapter detection failed');
    } finally {
      setDetectingChapters(false);
    }
  };

  const generateNotes = async () => {
    if (!title) { setError('Please enter a title first'); return; }
    setGeneratingNotes(true);
    setNoteGenStep(1);
    setNoteGenProgress(10);
    setError('');
    try {
      setNoteGenStep(videoFile ? 2 : 3);
      setNoteGenProgress(videoFile ? 30 : 50);
      const generated = await callGenerateNotes();
      setNoteGenStep(4);
      setNoteGenProgress(100);
      setNotes(generated);
      setTimeout(() => { setNoteGenStep(0); setNoteGenProgress(0); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate notes');
      setNoteGenStep(0);
      setNoteGenProgress(0);
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024 * 1024) {
        setError('Video file must be less than 25 GB');
        return;
      }
      setVideoFile(file);
      setError('');
      if (file.size > 25 * 1024 * 1024) {
        const chunks = Math.ceil(file.size / (24 * 1024 * 1024));
        setWarning(
          `File is ${(file.size / 1024 / 1024).toFixed(0)} MB — it will be split into ${chunks} chunk${chunks > 1 ? 's' : ''} for transcription. This works fine, just takes a bit longer.`
        );
      } else {
        setWarning('');
      }
    }
  };

  const xhrPost = (
    url: string,
    formData: FormData,
    onProgress: (loaded: number, total: number) => void
  ): Promise<Record<string, unknown>> => {
    return new Promise((resolve, reject) => {
      const user = getStoredUser();
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      if (user) {
        xhr.setRequestHeader('x-user-id', user.id);
        xhr.setRequestHeader('x-user-role', user.role);
      }
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  };

  const uploadVideo = async (): Promise<string | null> => {
    if (!videoFile) return null;

    setUploading(true);
    setUploadProgress(0);
    setUploadSpeed(0);
    setUploadETA(null);
    setUploadPhase('uploading');

    const fileSize = videoFile.size;
    const startTime = Date.now();

    const updateProgress = (bytesUploaded: number) => {
      const pct = Math.min(Math.round((bytesUploaded / fileSize) * 100), 99);
      setUploadProgress(pct);
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 0.3 && bytesUploaded > 0) {
        const speedBps = bytesUploaded / elapsed;
        setUploadSpeed(speedBps / (1024 * 1024));
        setUploadETA((fileSize - bytesUploaded) / speedBps);
      }
    };

    const CHUNK_SIZE   = 10 * 1024 * 1024; // 10 MB per chunk
    const PARALLELISM  = 4;               // chunks in-flight at once

    try {
      if (fileSize > 10 * 1024 * 1024) { // always chunk files > 10 MB
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
        const uploadId    = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

        // Track bytes uploaded per chunk slot for smooth progress
        const chunkUploaded = new Array<number>(totalChunks).fill(0);
        const getTotal = () => chunkUploaded.reduce((a, b) => a + b, 0);

        // Upload one chunk, updating its progress slot
        const uploadChunk = (i: number): Promise<Record<string, unknown>> => {
          const start = i * CHUNK_SIZE;
          const end   = Math.min(start + CHUNK_SIZE, fileSize);
          const chunk = videoFile.slice(start, end);

          const fd = new FormData();
          fd.append('chunk', chunk);
          fd.append('chunkIndex', String(i));
          fd.append('totalChunks', String(totalChunks));
          fd.append('uploadId', uploadId);
          fd.append('originalName', videoFile.name);

          return xhrPost('/api/upload', fd, (loaded) => {
            chunkUploaded[i] = loaded;
            updateProgress(getTotal());
          }).then(data => { chunkUploaded[i] = end - start; return data; });
        };

        // Run with limited concurrency
        let finalUrl = '';
        let next = 0;

        const worker = async () => {
          while (next < totalChunks) {
            const i = next++;
            const data = await uploadChunk(i);
            if (data.complete && data.url) finalUrl = data.url as string;
          }
        };

        await Promise.all(Array.from({ length: PARALLELISM }, worker));

        setUploadPhase('finalizing');
        setUploadProgress(100);
        return finalUrl;
      }

      // Single-request upload for small files
      const formData = new FormData();
      formData.append('file', videoFile);
      const data = await xhrPost('/api/upload', formData, (loaded) => {
        updateProgress(loaded);
      });

      setUploadPhase('finalizing');
      setUploadProgress(100);
      return data.url as string;
    } catch (err) {
      throw new Error('Failed to upload video');
    } finally {
      setUploading(false);
      setUploadPhase('done');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Upload video first if selected
      let videoUrl = null;
      if (videoFile) {
        videoUrl = await uploadVideo();
      }

      // Auto-generate notes if not already written
      let finalNotes = notes;
      if (!finalNotes.trim()) {
        setGeneratingNotes(true);
        setNoteGenStep(2);
        setNoteGenProgress(30);
        try {
          setNoteGenStep(3);
          setNoteGenProgress(60);
          finalNotes = await callGenerateNotes();
          setNotes(finalNotes);
          setNoteGenStep(4);
          setNoteGenProgress(100);
        } catch (genErr) {
          // Notes generation failed — warn but still allow saving lecture without notes
          console.warn('Note generation failed on submit:', genErr);
        } finally {
          setGeneratingNotes(false);
          setTimeout(() => { setNoteGenStep(0); setNoteGenProgress(0); }, 500);
        }
      }

      const res = await authFetch('/api/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          courseId,
          duration: 0,
          notes: finalNotes,
          videoUrl,
          chapters,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create lecture');
      }

      const created = await res.json();
      setSavedLectureId(created.lecture?.id ?? null);
      setSuccess(true);
      toast.success('Lecture created!');
      // Reset form
      setTitle('');
      setDescription('');
      setCourseId('');
      setNotes('');
      setChapters([]);
      setVideoFile(null);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/teacher');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📤</div>
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
          <h2 className="text-2xl font-bold mb-2">Lecture Created!</h2>
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
        <h1 className="text-3xl font-bold mb-2">📤 Upload New Lecture</h1>
        <p className="text-white/60">Add a new lecture to your course</p>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-6">
          {/* Course Selection */}
          <div>
            <label className="block text-sm text-white/70 mb-2">Select Course *</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="input-glass"
              required
            >
              <option value="">Choose a course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.icon} {course.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
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

          {/* Description */}
          <div>
            <label className="block text-sm text-white/70 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-glass min-h-[100px] resize-none"
              placeholder="Brief description of this lecture..."
            />
          </div>

          {/* Video Upload */}
          <div>
            <label className="block text-sm text-white/70 mb-2">Lecture Video</label>
            <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-emerald-500/50 transition cursor-pointer"
              onClick={() => document.getElementById('video-input')?.click()}
            >
              <input
                id="video-input"
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="hidden"
              />
              {videoFile ? (
                <div>
                  <span className="text-4xl block mb-2">🎬</span>
                  <p className="text-emerald-400 font-medium">{videoFile.name}</p>
                  <p className="text-white/50 text-sm">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setVideoFile(null); setWarning(''); }}
                    className="text-red-400 text-sm mt-2 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <span className="text-4xl block mb-2">📹</span>
                  <p className="text-white/70">Click to upload video</p>
                  <p className="text-white/40 text-sm">MP4, WebM, MOV (max 25 GB)</p>
                </div>
              )}
            </div>
            {uploading && (
              <div className="mt-3 p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                {/* Phase label + percentage */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70 font-medium">
                    {uploadPhase === 'finalizing' ? 'Finalizing…' : 'Uploading video'}
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">{uploadProgress}%</span>
                </div>

                {/* Progress bar */}
                <div className="relative h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-150 ease-linear"
                    style={{ width: `${uploadProgress}%` }}
                  />
                  {/* Shimmer effect while uploading */}
                  {uploadProgress < 100 && (
                    <div
                      className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full animate-shimmer"
                      style={{ left: `${Math.max(uploadProgress - 12, 0)}%` }}
                    />
                  )}
                </div>

                {/* Speed + ETA */}
                <div className="flex justify-between text-xs text-white/50">
                  <span>
                    {uploadSpeed > 0
                      ? `${uploadSpeed.toFixed(1)} MB/s`
                      : 'Connecting…'}
                  </span>
                  <span>
                    {uploadETA !== null && uploadETA > 1
                      ? uploadETA < 60
                        ? `${Math.round(uploadETA)}s remaining`
                        : `${Math.floor(uploadETA / 60)}m ${Math.round(uploadETA % 60)}s remaining`
                      : uploadProgress >= 99 ? 'Almost done…' : ''}
                  </span>
                </div>

                {/* Bytes transferred */}
                <p className="text-xs text-white/35">
                  {((uploadProgress / 100) * (videoFile?.size ?? 0) / (1024 * 1024)).toFixed(1)} MB
                  {' / '}
                  {((videoFile?.size ?? 0) / (1024 * 1024)).toFixed(1)} MB uploaded
                </p>
              </div>
            )}
            {warning && (
              <div className="mt-2 bg-amber-500/15 border border-amber-500/30 rounded-lg p-3 text-amber-300 text-sm flex gap-2">
                <span className="shrink-0">⚠️</span>
                <span>{warning}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-white/70">Lecture Notes (Markdown supported)</label>
              <button
                type="button"
                onClick={generateNotes}
                disabled={generatingNotes || !title}
                className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30 disabled:opacity-50 transition"
              >
                {generatingNotes ? (
                  <>
                    <span className="animate-spin">⚙️</span> {videoFile ? 'Transcribing & Generating...' : 'Generating...'}
                  </>
                ) : (
                  <>
                    🤖 {videoFile ? 'Generate from Video' : 'Auto-Generate Notes'}
                  </>
                )}
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-glass min-h-[200px] resize-none font-mono text-sm"
              placeholder="# Topic 1&#10;&#10;- Key point 1&#10;- Key point 2&#10;&#10;# Topic 2&#10;..."
            />
            <p className="text-white/40 text-xs mt-1">
              {videoFile
                ? 'Click "Generate from Video" to transcribe audio and create AI notes from the lecture content'
                : 'Click "Auto-Generate Notes" to create AI-powered notes based on the title and description'}
            </p>

            {/* Detect Chapters button (visible when video selected) */}
            {videoFile && (
              <button
                type="button"
                onClick={detectChapters}
                disabled={detectingChapters}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-sm hover:bg-blue-500/30 disabled:opacity-50 transition mt-2"
              >
                {detectingChapters
                  ? <><span className="animate-spin">⚙️</span> Detecting chapters...</>
                  : <>🔖 Detect Chapters from Video</>}
              </button>
            )}

            {/* Chapter preview */}
            {chapters.length > 0 && (
              <div className="mt-3 glass rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-300">🔖 {chapters.length} chapters detected</span>
                  <span className="text-xs text-white/40">· will be saved with this lecture</span>
                </div>
                {chapters.map((ch, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-white/5 last:border-0">
                    <span className="text-xs text-white/40 font-mono w-12 shrink-0">
                      {Math.floor(ch.startSec / 60)}:{String(Math.floor(ch.startSec % 60)).padStart(2, '0')}
                    </span>
                    <span className="text-sm text-white/80">{ch.title}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Progress Bar with Waypoints */}
            {generatingNotes && (
              <div className="mt-4 p-4 bg-white/5 rounded-xl">
                {/* Progress Bar */}
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${noteGenProgress}%` }}
                  />
                </div>
                
                {/* Waypoints */}
                <div className="flex justify-between items-center">
                  {[
                    { step: 1, label: 'Preparing', icon: '📦' },
                    { step: 2, label: 'Transcribing', icon: '🎙️' },
                    { step: 3, label: 'AI Processing', icon: '🤖' },
                    { step: 4, label: 'Complete', icon: '✅' },
                  ].map((waypoint, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                        noteGenStep >= waypoint.step 
                          ? noteGenStep === waypoint.step 
                            ? 'bg-purple-500 scale-110 animate-pulse' 
                            : 'bg-emerald-500'
                          : 'bg-white/10'
                      }`}>
                        {waypoint.icon}
                      </div>
                      <span className={`text-xs mt-1 ${
                        noteGenStep >= waypoint.step ? 'text-white' : 'text-white/40'
                      }`}>
                        {waypoint.label}
                      </span>
                      {noteGenStep === waypoint.step && waypoint.step < 4 && (
                        <span className="text-xs text-purple-400 animate-pulse">Processing...</span>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Status Text */}
                <p className="text-center text-sm text-white/60 mt-3">
                  {noteGenStep === 1 && 'Preparing your video for processing...'}
                  {noteGenStep === 2 && 'Transcribing audio using AI... This may take a moment for longer videos.'}
                  {noteGenStep === 3 && 'Generating comprehensive notes from transcript...'}
                  {noteGenStep === 4 && '🎉 Notes generated successfully!'}
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1 py-4 text-lg disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Creating...
                </span>
              ) : (
                '📤 Create Lecture'
              )}
            </button>
            <Link
              href="/dashboard/teacher"
              className="glass px-6 py-4 rounded-xl hover:bg-white/10 transition text-center"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* Help Card */}
        <div className="glass rounded-2xl p-6 mt-6">
          <h3 className="font-semibold mb-3">💡 Tips</h3>
          <ul className="text-white/60 text-sm space-y-2">
            <li>• Use descriptive titles for better organization</li>
            <li>• Use Auto-Generate to create AI-powered notes</li>
            <li>• Configure AI in Admin → AI Settings</li>
            <li>• Supported video formats: MP4, WebM, MOV</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
