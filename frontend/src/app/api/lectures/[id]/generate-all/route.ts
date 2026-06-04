/**
 * POST /api/lectures/[id]/generate-all
 *
 * Transcribes the lecture video ONCE, then runs all selected AI operations
 * in parallel using the same transcript — saving API credits vs separate calls.
 *
 * Body:
 *   generateNotes:   boolean  (default true)
 *   detectChapters:  boolean  (default false)
 *   generateQuiz:    boolean  (default false)
 *   quizTitle:       string   (required if generateQuiz)
 *   quizCount:       number   (default 5)
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

// ── Extract audio from any video format via ffmpeg ───────────────────────────
// Produces a 16 kHz mono MP3 (~0.5 MB/min) that Whisper can always decode,
// regardless of the original container (WebM, MKV, MOV, MP4, etc.).
async function extractAudio(videoPath: string): Promise<string> {
  const tmpAudio = path.join(tmpdir(), `gyanbrige-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-vn',            // drop video stream
    '-ar', '16000',   // 16 kHz — enough for speech
    '-ac', '1',       // mono
    '-acodec', 'libmp3lame',
    '-q:a', '4',      // ~128 kbps
    '-y',             // overwrite temp file if it somehow exists
    tmpAudio,
  ]);
  return tmpAudio;
}

// ── Send one ≤24 MB audio range to Whisper ───────────────────────────────────
async function transcribeChunkFromDisk(filePath: string, start: number, end: number, partNum: number, key: string, language = 'auto'): Promise<string> {
  const stream = createReadStream(filePath, { start, end });
  const chunks: Buffer[] = [];
  for await (const chunk of Readable.from(stream)) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const blob = new Blob([Buffer.concat(chunks)], { type: 'audio/mpeg' });
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

// ── Transcribe any video file: extract audio → chunk → Whisper ───────────────
async function transcribeVideoPath(filePath: string, key: string, language = 'auto'): Promise<string> {
  const audioPath = await extractAudio(filePath);
  try {
    const { size } = statSync(audioPath);
    const parts: string[] = [];
    let offset = 0, part = 0;
    while (offset < size) {
      const end = Math.min(offset + WHISPER_CHUNK - 1, size - 1);
      parts.push(await transcribeChunkFromDisk(audioPath, offset, end, part, key, language));
      offset += WHISPER_CHUNK; part++;
    }
    return parts.join(' ');
  } finally {
    await unlink(audioPath).catch(() => {});
  }
}

// ── GPT call helper ──────────────────────────────────────────────────────────

async function gpt(prompt: string, key: string, model: string, maxTokens = 2000): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `OpenAI ${res.status}`); }
  const d = await res.json();
  return d.choices?.[0]?.message?.content?.trim() ?? '';
}

/** Safely parse a JSON array from raw GPT output — handles truncated/malformed responses */
function safeParseArray<T>(raw: string): T[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T[];
  } catch {
    // GPT truncated mid-JSON — attempt to recover by closing unclosed structure
    try {
      const partial = match[0]
        .replace(/,\s*$/, '')              // trailing comma
        .replace(/\{[^}]*$/, '')           // unclosed last object
        .replace(/,\s*$/, '')              // trailing comma again
        + ']';
      return JSON.parse(partial) as T[];
    } catch {
      return null;
    }
  }
}

// ── Operation: generate notes ────────────────────────────────────────────────

const LANG_RULE = `LANGUAGE RULE: The lecture may be in English, Hindi, Marathi, or a mix (Hinglish, Marathi-English, etc.). Write your response in the EXACT SAME LANGUAGE(S) as the transcript — do NOT translate. Match the language mix the teacher used.`;

async function generateNotes(title: string, transcript: string, key: string, model: string): Promise<string> {
  return gpt(
    `Generate comprehensive lecture notes for this lecture.

${LANG_RULE}

Title: ${title}
Transcript:
${transcript.slice(0, 12000)}

Structure:
- ## Headings for main topics
- Bullet points for key concepts
- **Bold** for important terms
- Summary section at the end

Notes:`,
    key, model, 2000
  );
}

// ── Operation: detect chapters ───────────────────────────────────────────────

async function detectChapters(title: string, transcript: string, duration: number, key: string, model: string): Promise<Chapter[]> {
  // Build a rough timestamped text from the transcript for chapter detection
  const words = transcript.split(/\s+/);
  const segSize = Math.max(1, Math.floor(words.length / 20));
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += segSize) {
    const sec = Math.round((i / words.length) * duration);
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    lines.push(`[${m}:${s}] ${words.slice(i, i + segSize).join(' ')}`);
  }

  const raw = await gpt(
    `Create YouTube-style chapter markers for this ${Math.round(duration / 60)}-minute lecture.
First chapter at 00:00 titled "Introduction". 3-8 chapters, 2-5 word titles, min 90s per chapter.

${LANG_RULE}
Chapter titles should be in the same language as the lecture content.

${lines.join('\n').slice(0, 8000)}

Return ONLY a complete JSON array (no markdown, no truncation):
[{"startSec":0,"title":"Introduction"},{"startSec":120,"title":"Core Concepts"}]`,
    key, model, 600
  );
  const chapters = safeParseArray<Chapter>(raw);
  if (!chapters?.length) return [{ startSec: 0, title: 'Introduction' }];
  if (!chapters.find(c => c.startSec === 0)) chapters.unshift({ startSec: 0, title: 'Introduction' });
  return chapters.sort((a, b) => a.startSec - b.startSec);
}

// ── Operation: generate quiz ─────────────────────────────────────────────────

async function generateQuizQuestions(
  title: string, transcript: string, count: number, key: string, model: string
): Promise<{ question: string; options: string[]; correctAnswer: number; explanation: string }[]> {
  const raw = await gpt(
    `Create ${count} multiple-choice quiz questions based on this lecture.

${LANG_RULE}
Write questions and options in the same language as the lecture content.

Title: ${title}
Content: ${transcript.slice(0, 8000)}

Rules:
- 4 options per question, exactly one correct
- Vary difficulty (easy, medium, hard)
- Include a brief explanation for the correct answer

Return ONLY a complete JSON array (no markdown, no truncation):
[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]`,
    key, model, Math.min(count * 300, 3000)
  );
  return safeParseArray(raw) ?? [];
}

// ── Route handler ────────────────────────────────────────────────────────────

export const POST = logRoute(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const {
    generateNotes:  doNotes    = true,
    detectChapters: doChapters = false,
    generateQuiz:   doQuiz     = false,
    quizTitle = `Quiz: ${lecture.title}`,
    quizCount = 5,
  } = body as {
    generateNotes?: boolean; detectChapters?: boolean; generateQuiz?: boolean;
    quizTitle?: string; quizCount?: number;
  };

  // ── Step 1: get transcript (once, regardless of how many operations) ────────
  let transcript = '';
  let transcriptSource = 'none';

  if (lecture.segments?.length) {
    transcript      = lecture.segments.map((s: { text: string }) => s.text).join(' ');
    transcriptSource = 'stored';
  } else if (lecture.videoUrl) {
    const videoPath = path.join(process.cwd(), 'public', lecture.videoUrl);
    if (existsSync(videoPath)) {
      try {
        // Stream the file in 24 MB chunks — never loads the whole thing into RAM
        transcript       = await transcribeVideoPath(videoPath, openaiKey, whisperLang);
        transcriptSource = 'video';
        // Persist so future regenerations are instant
        if (transcript) {
          lectures.update(id, {
            segments: [{ start: 0, end: lecture.duration * 60, text: transcript }],
          });
        }
      } catch (transcribeErr) {
        return NextResponse.json(
          { error: `Video transcription failed: ${(transcribeErr as Error).message}` },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Video file not found on server. Re-upload the lecture video.' },
        { status: 404 }
      );
    }
  }

  // ── Step 2: run all selected operations in parallel ─────────────────────────
  const ops: Promise<unknown>[] = [];

  const notesPromise    = doNotes    ? generateNotes(lecture.title, transcript, openaiKey, openaiModel) : Promise.resolve(null);
  const chaptersPromise = doChapters ? detectChapters(lecture.title, transcript, lecture.duration * 60, openaiKey, openaiModel) : Promise.resolve(null);
  const quizPromise     = doQuiz     ? generateQuizQuestions(lecture.title, transcript, quizCount, openaiKey, openaiModel) : Promise.resolve(null);

  ops.push(notesPromise, chaptersPromise, quizPromise);

  const [notesResult, chaptersResult, quizQuestionsResult] = await Promise.allSettled(ops);

  // ── Step 3: persist results ──────────────────────────────────────────────────
  const updates: Partial<typeof lecture> = {};
  const result: Record<string, unknown> = { transcriptSource };

  if (notesResult.status === 'fulfilled' && notesResult.value) {
    updates.notes = notesResult.value as string;
    result.notes  = notesResult.value;
  } else if (notesResult.status === 'rejected') {
    result.notesError = (notesResult.reason as Error).message;
  }

  if (chaptersResult.status === 'fulfilled' && chaptersResult.value) {
    updates.chapters  = chaptersResult.value as Chapter[];
    result.chapters   = chaptersResult.value;
  } else if (chaptersResult.status === 'rejected') {
    result.chaptersError = (chaptersResult.reason as Error).message;
  }

  let quizOut = null;
  if (quizQuestionsResult.status === 'fulfilled' && quizQuestionsResult.value) {
    const questions = quizQuestionsResult.value as { question: string; options: string[]; correctAnswer: number; explanation: string }[];
    const quiz = quizzes.create({ lectureId: id, courseId: lecture.courseId, title: quizTitle });
    questions.forEach((q, i) => quizzes.addQuestion(quiz.id, { ...q, order: i + 1 }));
    quizOut = quizzes.getById(quiz.id);
    result.quiz = quizOut;
  } else if (quizQuestionsResult.status === 'rejected') {
    result.quizError = (quizQuestionsResult.reason as Error).message;
  }

  if (Object.keys(updates).length) lectures.update(id, updates);

  return NextResponse.json({ success: true, ...result });
}
);
