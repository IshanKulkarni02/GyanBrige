/**
 * POST /api/lectures/[id]/generate-all
 *
 * Streams Server-Sent Events (text/event-stream) so the client can show
 * real-time progress for every stage: ffmpeg extraction, Whisper chunking,
 * notes generation, chapter detection, and quiz creation.
 *
 * Each SSE line:  data: <JSON>\n\n
 * Final event:    { type: "complete", notes, chapters, quiz, transcriptSource }
 * Error event:    { type: "error", msg }
 *
 * Early validation failures (auth, missing key, bad body) still return plain
 * NextResponse.json() so the client can handle them with res.ok checks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { lectures, quizzes, settings as dbSettings, type Chapter } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { createReadStream, existsSync, statSync } from 'fs';
import { unlink } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import path from 'path';
import { Readable } from 'stream';
import { logRoute, withRetry } from '@/lib/logger';

export const maxDuration = 3600;

const execFileAsync = promisify(execFile);
const WHISPER_CHUNK = 24 * 1024 * 1024;

// ── Audio extraction ─────────────────────────────────────────────────────────

async function extractAudio(videoPath: string): Promise<string> {
  const tmpAudio = path.join(tmpdir(), `gyanbrige-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  await execFileAsync('ffmpeg', [
    '-i', videoPath, '-vn', '-ar', '16000', '-ac', '1',
    '-acodec', 'libmp3lame', '-q:a', '4', '-y', tmpAudio,
  ]);
  return tmpAudio;
}

// ── Whisper: one ≤24 MB chunk ─────────────────────────────────────────────────

async function transcribeChunkFromDisk(
  filePath: string, start: number, end: number, partNum: number, key: string, language = 'auto'
): Promise<string> {
  const stream = createReadStream(filePath, { start, end });
  const bufs: Buffer[] = [];
  for await (const chunk of Readable.from(stream)) bufs.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const blob = new Blob([Buffer.concat(bufs)], { type: 'audio/mpeg' });
  const fd = new FormData();
  fd.append('file', blob, `part${partNum}.mp3`);
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'text');
  if (language && language !== 'auto') fd.append('language', language);
  return withRetry(async () => {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd,
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `Whisper ${res.status}`); }
    return res.text();
  }, 3, 3000, `Whisper part${partNum}`);
}

// ── GPT helper ───────────────────────────────────────────────────────────────

async function gpt(prompt: string, key: string, model: string, maxTokens = 2000): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.4 }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `OpenAI ${res.status}`); }
  const d = await res.json();
  return d.choices?.[0]?.message?.content?.trim() ?? '';
}

function safeParseArray<T>(raw: string): T[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as T[]; } catch {
    try {
      const fixed = match[0].replace(/,\s*$/, '').replace(/\{[^}]*$/, '').replace(/,\s*$/, '') + ']';
      return JSON.parse(fixed) as T[];
    } catch { return null; }
  }
}

const LANG_RULE = `LANGUAGE RULE: The lecture may be in English, Hindi, Marathi, or a mix. Write your response in the EXACT SAME LANGUAGE(S) as the transcript — do NOT translate.`;

async function generateNotes(title: string, transcript: string, key: string, model: string): Promise<string> {
  return gpt(`Generate comprehensive lecture notes.\n\n${LANG_RULE}\n\nTitle: ${title}\nTranscript:\n${transcript.slice(0, 12000)}\n\nStructure:\n- ## Headings\n- Bullet points\n- **Bold** terms\n- Summary at end\n\nNotes:`, key, model, 2000);
}

async function detectChapters(title: string, transcript: string, duration: number, key: string, model: string): Promise<Chapter[]> {
  const words = transcript.split(/\s+/);
  const segSize = Math.max(1, Math.floor(words.length / 20));
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += segSize) {
    const sec = Math.round((i / words.length) * duration);
    lines.push(`[${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}] ${words.slice(i,i+segSize).join(' ')}`);
  }
  const raw = await gpt(
    `Create YouTube-style chapter markers for this ${Math.round(duration/60)}-min lecture.\nFirst chapter at 00:00 titled "Introduction". 3-8 chapters, 2-5 word titles, min 90s each.\n\n${LANG_RULE}\n\n${lines.join('\n').slice(0,8000)}\n\nReturn ONLY JSON array:\n[{"startSec":0,"title":"Introduction"},...]`,
    key, model, 600
  );
  const chapters = safeParseArray<Chapter>(raw);
  if (!chapters?.length) return [{ startSec: 0, title: 'Introduction' }];
  if (!chapters.find(c => c.startSec === 0)) chapters.unshift({ startSec: 0, title: 'Introduction' });
  return chapters.sort((a, b) => a.startSec - b.startSec);
}

async function generateQuizQuestions(title: string, transcript: string, count: number, key: string, model: string) {
  const raw = await gpt(
    `Create ${count} multiple-choice quiz questions.\n\n${LANG_RULE}\n\nTitle: ${title}\nContent: ${transcript.slice(0,8000)}\n\nRules: 4 options, one correct, vary difficulty, include explanation.\n\nReturn ONLY JSON:\n[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]`,
    key, model, Math.min(count * 300, 3000)
  );
  return safeParseArray<{ question: string; options: string[]; correctAnswer: number; explanation: string }>(raw) ?? [];
}

// ── SSE helper type ───────────────────────────────────────────────────────────

type Emit = (data: Record<string, unknown>) => void;

// ── Route handler ─────────────────────────────────────────────────────────────

export const POST = logRoute(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Validate before opening the stream ──────────────────────────────────────
  const caller = requireAuth(request);
  if (!caller || caller.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const lecture = lectures.getById(id);
  if (!lecture) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });

  const s = dbSettings.getAll();
  const openaiKey   = s.openaiKey   || process.env.OPENAI_API_KEY;
  const openaiModel = s.openaiModel || 'gpt-4o-mini';
  const whisperLang = s.transcriptionLanguage || 'auto';
  if (!openaiKey) return NextResponse.json({ error: 'OpenAI API key not configured. Set it in Admin → AI Settings.' }, { status: 400 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const {
    generateNotes:  doNotes    = true,
    detectChapters: doChapters = false,
    generateQuiz:   doQuiz     = false,
    quizTitle = `Quiz: ${lecture.title}`,
    quizCount = 5,
  } = body as { generateNotes?: boolean; detectChapters?: boolean; generateQuiz?: boolean; quizTitle?: string; quizCount?: number };

  // ── Open SSE stream ──────────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (data) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* client disconnected */ }
      };

      try {
        // ── Stage 1: transcript ────────────────────────────────────────────────
        let transcript = '';
        let transcriptSource = 'none';

        if (lecture.segments?.length) {
          transcript = lecture.segments.map((s: { text: string }) => s.text).join(' ');
          transcriptSource = 'stored';
          const words = transcript.split(/\s+/).filter(Boolean).length;
          emit({ type: 'transcript_cached', words, pct: 20,
            msg: `Transcript ready`, detail: `${words.toLocaleString()} words already stored` });

        } else if (lecture.videoUrl) {
          const videoPath = path.join(process.cwd(), 'public', lecture.videoUrl);
          if (!existsSync(videoPath)) {
            emit({ type: 'error', msg: 'Video file not found on server. Re-upload the lecture video.' });
            controller.close(); return;
          }

          const videoSizeMB = (statSync(videoPath).size / 1024 / 1024).toFixed(1);
          emit({ type: 'extract_start', pct: 5,
            msg: 'Extracting audio', detail: `${videoSizeMB} MB video → MP3` });

          let audioPath: string;
          try {
            audioPath = await extractAudio(videoPath);
          } catch (err) {
            emit({ type: 'error', msg: `Audio extraction failed: ${err instanceof Error ? err.message : String(err)}` });
            controller.close(); return;
          }

          const audioSize = statSync(audioPath).size;
          const audioMB   = (audioSize / 1024 / 1024).toFixed(1);
          const totalParts = Math.ceil(audioSize / WHISPER_CHUNK);
          emit({ type: 'extract_done', audioMB: parseFloat(audioMB), pct: 20,
            msg: 'Audio extracted', detail: `${audioMB} MB MP3 · ${totalParts} chunk${totalParts > 1 ? 's' : ''} to transcribe` });

          emit({ type: 'whisper_start', totalParts, pct: 22,
            msg: 'Sending to Whisper AI', detail: totalParts > 1 ? `${totalParts} parts` : 'single chunk' });

          try {
            const parts: string[] = [];
            let offset = 0, partNum = 0;
            while (offset < audioSize) {
              const end = Math.min(offset + WHISPER_CHUNK - 1, audioSize - 1);
              const chunkMB = ((end - offset + 1) / 1024 / 1024).toFixed(1);
              emit({ type: 'whisper_chunk', part: partNum + 1, total: totalParts,
                pct: Math.round(22 + ((partNum) / totalParts) * 35),
                msg: 'Transcribing audio',
                detail: totalParts > 1 ? `Part ${partNum + 1} of ${totalParts} · ${chunkMB} MB` : `${chunkMB} MB chunk` });
              const text = await transcribeChunkFromDisk(audioPath, offset, end, partNum, openaiKey, whisperLang);
              parts.push(text);
              offset += WHISPER_CHUNK; partNum++;
            }
            transcript = parts.join(' ');
            transcriptSource = 'video';
            if (transcript) lectures.update(id, { segments: [{ start: 0, end: lecture.duration * 60, text: transcript }] });

            const words = transcript.split(/\s+/).filter(Boolean).length;
            emit({ type: 'whisper_done', words, pct: 58,
              msg: 'Transcript ready', detail: `${words.toLocaleString()} words` });
          } finally {
            await unlink(audioPath).catch(() => {});
          }
        }

        // ── Stage 2: parallel AI generation ───────────────────────────────────
        if (doNotes)    emit({ type: 'notes_start',    pct: 62, msg: 'Generating notes',    detail: 'Sending transcript to GPT…' });
        if (doChapters) emit({ type: 'chapters_start', pct: 64, msg: 'Detecting bookmarks', detail: 'Analysing topic changes…' });
        if (doQuiz)     emit({ type: 'quiz_start',     pct: 66, msg: 'Creating quiz',       detail: `${quizCount} questions…` });

        // Wire up .then() so each done-event fires the moment its promise resolves
        const notesPromise = doNotes
          ? generateNotes(lecture.title, transcript, openaiKey, openaiModel)
              .then(r => { const w = r.split(/\s+/).filter(Boolean).length; emit({ type: 'notes_done', words: w, pct: 78, msg: 'Notes ready', detail: `${w.toLocaleString()} words` }); return r; })
          : Promise.resolve(null);

        const chaptersPromise = doChapters
          ? detectChapters(lecture.title, transcript, lecture.duration * 60, openaiKey, openaiModel)
              .then(r => { emit({ type: 'chapters_done', count: r.length, pct: 88, msg: 'Bookmarks ready', detail: `${r.length} chapters detected` }); return r; })
          : Promise.resolve(null);

        const quizPromise = doQuiz
          ? generateQuizQuestions(lecture.title, transcript, quizCount, openaiKey, openaiModel)
              .then(r => { emit({ type: 'quiz_done', count: r.length, pct: 96, msg: 'Quiz ready', detail: `${r.length} questions created` }); return r; })
          : Promise.resolve(null);

        const [notesResult, chaptersResult, quizResult] = await Promise.allSettled([notesPromise, chaptersPromise, quizPromise]);

        // ── Stage 3: persist & build final payload ─────────────────────────────
        const updates: Partial<typeof lecture> = {};
        const payload: Record<string, unknown> = { transcriptSource };

        if (notesResult.status === 'fulfilled' && notesResult.value) {
          updates.notes  = notesResult.value as string;
          payload.notes  = notesResult.value;
        } else if (notesResult.status === 'rejected') {
          payload.notesError = (notesResult.reason as Error).message;
        }

        if (chaptersResult.status === 'fulfilled' && chaptersResult.value) {
          updates.chapters  = chaptersResult.value as Chapter[];
          payload.chapters  = chaptersResult.value;
        } else if (chaptersResult.status === 'rejected') {
          payload.chaptersError = (chaptersResult.reason as Error).message;
        }

        if (quizResult.status === 'fulfilled' && quizResult.value) {
          const questions = quizResult.value as { question: string; options: string[]; correctAnswer: number; explanation: string }[];
          const quiz = quizzes.create({ lectureId: id, courseId: lecture.courseId, title: quizTitle as string });
          questions.forEach((q, i) => quizzes.addQuestion(quiz.id, { ...q, order: i + 1 }));
          payload.quiz = quizzes.getById(quiz.id);
        } else if (quizResult.status === 'rejected') {
          payload.quizError = (quizResult.reason as Error).message;
        }

        if (Object.keys(updates).length) lectures.update(id, updates);

        emit({ type: 'complete', pct: 100, msg: 'Done!', detail: '', success: true, ...payload });

      } catch (err) {
        emit({ type: 'error', msg: err instanceof Error ? err.message : 'Generation failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
});
