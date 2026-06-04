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
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export const maxDuration = 3600;

const WHISPER_CHUNK = 24 * 1024 * 1024;

// ── Shared: transcribe any size file ────────────────────────────────────────

async function transcribeChunkText(blob: Blob, filename: string, key: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'text');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `Whisper ${res.status}`); }
  return res.text();
}

async function transcribeFile(file: File, key: string): Promise<string> {
  if (file.size <= WHISPER_CHUNK) return transcribeChunkText(file, file.name, key);
  const ext = file.name.split('.').pop() ?? 'mp4';
  const parts: string[] = [];
  let offset = 0, part = 0;
  while (offset < file.size) {
    parts.push(await transcribeChunkText(file.slice(offset, offset + WHISPER_CHUNK), `p${part}.${ext}`, key));
    offset += WHISPER_CHUNK; part++;
  }
  return parts.join(' ');
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

async function generateNotes(title: string, transcript: string, key: string, model: string): Promise<string> {
  return gpt(
    `Generate comprehensive lecture notes for this lecture.

Title: ${title}
Transcript:
${transcript.slice(0, 12000)}

Generate well-structured markdown notes:
- Main topics as ## headings
- Key points as bullet points
- Important terms in **bold**
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

${lines.join('\n').slice(0, 8000)}

Return ONLY a complete JSON array (no markdown, no truncation):
[{"startSec":0,"title":"Introduction"},{"startSec":120,"title":"Core Concepts"}]`,
    key, model, 600  // raised from 300 — 8 chapters × ~15 tokens = ~120, keep headroom
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

Title: ${title}
Content: ${transcript.slice(0, 8000)}

Rules:
- 4 options per question, exactly one correct
- Vary difficulty (easy, medium, hard)
- Include a brief explanation for the correct answer

Return ONLY a complete JSON array (no markdown, no truncation):
[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]`,
    key, model, Math.min(count * 300, 3000)  // raised per-question budget: 300 tokens each
  );
  return safeParseArray(raw) ?? [];
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(
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

  if (!openaiKey) return NextResponse.json({ error: 'OpenAI API key not configured. Set it in Admin → AI Settings.' }, { status: 400 });

  const body = await request.json();
  const {
    generateNotes:  doNotes    = true,
    detectChapters: doChapters = false,
    generateQuiz:   doQuiz     = false,
    quizTitle = `Quiz: ${lecture.title}`,
    quizCount = 5,
  } = body;

  // ── Step 1: get transcript (once, regardless of how many operations) ────────
  let transcript = '';
  let transcriptSource = 'none';

  if (lecture.segments?.length) {
    transcript      = lecture.segments.map((s: { text: string }) => s.text).join(' ');
    transcriptSource = 'stored';
  } else if (lecture.videoUrl) {
    const videoPath = path.join(process.cwd(), 'public', lecture.videoUrl);
    if (existsSync(videoPath)) {
      const ext  = path.extname(lecture.videoUrl).slice(1) || 'mp4';
      const buf  = readFileSync(videoPath);
      const file = new File([buf], `lecture.${ext}`, { type: `video/${ext}` });
      transcript  = await transcribeFile(file, openaiKey);
      transcriptSource = 'video';
      // Save for future — avoids re-transcribing
      if (transcript) {
        lectures.update(id, {
          segments: [{ start: 0, end: lecture.duration * 60, text: transcript }],
        });
      }
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
