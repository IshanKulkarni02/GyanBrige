'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  const [error, setError] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [noteGenStep, setNoteGenStep] = useState(0); // 0: idle, 1: preparing, 2: transcribing, 3: generating, 4: done
  const [noteGenProgress, setNoteGenProgress] = useState(0);

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

  const generateNotes = async () => {
    if (!title) {
      setError('Please enter a title first');
      return;
    }
    setGeneratingNotes(true);
    setNoteGenStep(1);
    setNoteGenProgress(10);
    setError('');
    
    try {
      // Get AI settings from localStorage
      const aiSettings = localStorage.getItem('aiSettings');
      const settings = aiSettings ? JSON.parse(aiSettings) : {};
      const useLocalAI = settings.useLocalAI || false;
      
      let res;
      
      if (videoFile && !useLocalAI) {
        // ChatGPT: Send audio directly to generate-notes API (it will transcribe internally)
        setNoteGenStep(2);
        setNoteGenProgress(30);
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('audio', videoFile);
        
        setNoteGenStep(3);
        setNoteGenProgress(50);
        
        res = await fetch('/api/generate-notes', {
          method: 'POST',
          headers: {
            'x-use-local-ai': 'false',
            'x-openai-model': settings.openaiModel || 'gpt-4o-mini',
            'x-openai-key': settings.openaiKey || '',
          },
          body: formData,
        });
        
        setNoteGenProgress(90);
      } else if (videoFile && useLocalAI) {
        // Ollama: Transcribe first, then send transcript
        setNoteGenStep(2);
        setNoteGenProgress(30);
        
        // Transcribe using OpenAI Whisper first
        const audioFormData = new FormData();
        audioFormData.append('file', videoFile);
        
        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: {
            'x-openai-key': settings.openaiKey || '',
          },
          body: audioFormData,
        });
        
        setNoteGenProgress(60);
        
        const transcribeData = await transcribeRes.json();
        const transcript = transcribeData.transcript || '';
        
        // Step 3: Send transcript to Ollama
        setNoteGenStep(3);
        setNoteGenProgress(75);
        
        res = await fetch('/api/generate-notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-use-local-ai': 'true',
            'x-ollama-model': settings.ollamaModel || 'llama2',
          },
          body: JSON.stringify({ title, description, transcript }),
        });
        
        setNoteGenProgress(90);
      } else {
        // No video: just generate from title/description
        setNoteGenStep(3);
        setNoteGenProgress(50);
        
        res = await fetch('/api/generate-notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-use-local-ai': String(useLocalAI),
            'x-ollama-model': settings.ollamaModel || 'llama2',
            'x-openai-model': settings.openaiModel || 'gpt-4o-mini',
            'x-openai-key': settings.openaiKey || '',
          },
          body: JSON.stringify({ title, description }),
        });
        
        setNoteGenProgress(90);
      }
      
      const data = await res.json();
      if (data.notes) {
        setNotes(data.notes);
        setNoteGenStep(4);
        setNoteGenProgress(100);
        
        // Reset after showing completion
        setTimeout(() => {
          setNoteGenStep(0);
          setNoteGenProgress(0);
        }, 1500);
      }
    } catch (err) {
      setError('Failed to generate notes. Make sure OpenAI API key is set in Admin > AI Settings.');
      setNoteGenStep(0);
      setNoteGenProgress(0);
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 100GB)
      if (file.size > 100 * 1024 * 1024 * 1024) {
        setError('Video file must be less than 100GB');
        return;
      }
      setVideoFile(file);
      setError('');
    }
  };

  const uploadVideo = async (): Promise<string | null> => {
    if (!videoFile) return null;
    
    setUploading(true);
    setUploadProgress(0);
    
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const fileSize = videoFile.size;
    
    // Use chunked upload for files > 50MB
    if (fileSize > 50 * 1024 * 1024) {
      try {
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
        const uploadId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        let finalUrl = '';
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fileSize);
          const chunk = videoFile.slice(start, end);
          
          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('chunkIndex', String(i));
          formData.append('totalChunks', String(totalChunks));
          formData.append('uploadId', uploadId);
          formData.append('originalName', videoFile.name);
          
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (!res.ok) {
            throw new Error(`Chunk ${i + 1} upload failed`);
          }
          
          const data = await res.json();
          setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
          
          if (data.complete && data.url) {
            finalUrl = data.url;
          }
        }
        
        return finalUrl;
      } catch (err) {
        throw new Error('Failed to upload video');
      } finally {
        setUploading(false);
      }
    }
    
    // Regular upload for smaller files
    const formData = new FormData();
    formData.append('file', videoFile);
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('Video upload failed');
      }
      
      const data = await res.json();
      setUploadProgress(100);
      return data.url;
    } catch (err) {
      throw new Error('Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  // Generate notes and return them (used by handleSubmit)
  const generateNotesInternal = async (): Promise<string> => {
    const aiSettings = localStorage.getItem('aiSettings');
    const settings = aiSettings ? JSON.parse(aiSettings) : {};
    const useLocalAI = settings.useLocalAI || false;
    
    let res;
    
    if (videoFile && !useLocalAI) {
      // ChatGPT: Send audio directly
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('audio', videoFile);
      
      res = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: {
          'x-use-local-ai': 'false',
          'x-openai-model': settings.openaiModel || 'gpt-4o-mini',
          'x-openai-key': settings.openaiKey || '',
        },
        body: formData,
      });
    } else if (videoFile && useLocalAI) {
      // Ollama: Transcribe first, then send transcript
      const audioFormData = new FormData();
      audioFormData.append('file', videoFile);
      
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-key': settings.openaiKey || '',
        },
        body: audioFormData,
      });
      
      const transcribeData = await transcribeRes.json();
      const transcript = transcribeData.transcript || '';
      
      res = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-use-local-ai': 'true',
          'x-ollama-model': settings.ollamaModel || 'llama2',
        },
        body: JSON.stringify({ title, description, transcript }),
      });
    } else {
      // No video: just generate from title/description
      res = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-use-local-ai': String(useLocalAI),
          'x-ollama-model': settings.ollamaModel || 'llama2',
          'x-openai-model': settings.openaiModel || 'gpt-4o-mini',
          'x-openai-key': settings.openaiKey || '',
        },
        body: JSON.stringify({ title, description }),
      });
    }
    
    const data = await res.json();
    return data.notes || '';
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
      
      // Always generate notes if not already present
      let finalNotes = notes;
      if (!finalNotes.trim()) {
        setGeneratingNotes(true);
        setNoteGenStep(2);
        setNoteGenProgress(30);
        
        try {
          setNoteGenStep(3);
          setNoteGenProgress(60);
          finalNotes = await generateNotesInternal();
          setNotes(finalNotes);
          setNoteGenStep(4);
          setNoteGenProgress(100);
        } catch {
          // Continue with empty notes if generation fails
          finalNotes = '';
        } finally {
          setGeneratingNotes(false);
          setTimeout(() => {
            setNoteGenStep(0);
            setNoteGenProgress(0);
          }, 500);
        }
      }

      const res = await fetch('/api/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          courseId,
          duration: 0,
          notes: finalNotes,
          videoUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create lecture');
      }

      setSuccess(true);
      // Reset form
      setTitle('');
      setDescription('');
      setCourseId('');
      setNotes('');
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
                    onClick={(e) => { e.stopPropagation(); setVideoFile(null); }}
                    className="text-red-400 text-sm mt-2 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <span className="text-4xl block mb-2">📹</span>
                  <p className="text-white/70">Click to upload video</p>
                  <p className="text-white/40 text-sm">MP4, WebM, MOV (max 100GB)</p>
                </div>
              )}
            </div>
            {uploading && (
              <div className="mt-2">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-white/50 text-sm mt-1">Uploading... {uploadProgress}%</p>
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
                : 'Click "Auto-Generate Notes" to create AI-powered notes based on the title and description'
              }
            </p>
            
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
