/**
 * POST /api/lectures/[id]/chapters
 *
 * Accepts a video/audio file in FormData (field: "audio").
 * 1. Transcribes with Whisper verbose_json to get timestamped segments.
 * 2. Sends the timestamped transcript to GPT and asks it to detect
 *    topic-change chapter markers (like YouTube chapters).
 * 3. Saves segments + chapters to the lecture record.
 * 4. Returns { chapters, segments }.
 *
 * If the lecture already has segments (from a previous transcription)
 * you can omit the file and pass `{ useExisting: true }` as JSON.
 */

import { NextRequest, NextResponse } from 'next/server';
import { lectures, type Segment, type Chapter } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export const maxDuration = 3600;

const WHISPER_CHUNK = 24 * 1024 * 1024; // 24 MB

// ── Whisper transcription returning timestamped segments ──────────────────────

interface WhisperSegment { start: number; end: number; text: string; }

async function transcribeChunkVerbose(blob: Blob, filename: string, openaiKey: string): Promise<WhisperSegment[]> {
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'segment');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Whisper error ${res.status}`);
  }
  const data = await res.json() as { segments?: WhisperSegment[] };
  return data.segments ?? [];
}

async function transcribeFile(file: File, openaiKey: string): Promise<WhisperSegment[]> {
  if (file.size <= WHISPER_CHUNK) {
    return transcribeChunkVerbose(file, file.name, openaiKey);
  }
  const ext = file.name.split('.').pop() ?? 'mp4';
  const allSegments: WhisperSegment[] = [];
  let offset = 0, part = 0, timeOffset = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + WHISPER_CHUNK);
    const segs = await transcribeChunkVerbose(chunk, `part${part}.${ext}`, openaiKey);
    // Estimate duration from last segment's end to offset time for next chunk
    const chunkDuration = segs.length ? segs[segs.length - 1].end : 0;
    allSegments.push(...segs.map(s => ({ ...s, start: s.start + timeOffset, end: s.end + timeOffset })));
    timeOffset += chunkDuration;
    offset += WHISPER_CHUNK;
    part++;
  }
  return allSegments;
}

// ── Chapter detection with GPT ────────────────────────────────────────────────

function formatTranscript(segments: WhisperSegment[]): string {
  return segments.map(s => {
    const m = Math.floor(s.start / 60).toString().padStart(2, '0');
    const sec = Math.floor(s.start % 60).toString().padStart(2, '0');
    return `[${m}:${sec}] ${s.text.trim()}`;
  }).join('\n');
}

async function detectChapters(segments: WhisperSegment[], openaiKey: string, openaiModel: string): Promise<Chapter[]> {
  if (segments.length === 0) return [];

  const totalDuration = segments[segments.length - 1]?.end ?? 0;
  const formatted = formatTranscript(segments);

  const prompt = `You are analyzing a lecture transcript to create YouTube-style chapter markers.

Total duration: ${Math.round(totalDuration / 60)} minutes

RULES:
- Create 3–8 chapters (more for longer lectures)
- First chapter MUST start at second 0, titled "Introduction"
- Each title: 2–5 words, clear and descriptive
- Only mark a new chapter when the topic genuinely changes
- Minimum chapter length: 90 seconds
- Titles should reflect actual content, not generic labels

Transcript (format [MM:SS] text):
${formatted.slice(0, 12000)}

Return ONLY a valid JSON array — no markdown, no explanation:
[{"startSec":0,"title":"Introduction"},{"startSec":145,"title":"Core Concepts"},...]`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: openaiModel,
      messages: [
        { role: 'system', content: 'You extract chapter markers from lecture transcripts. Return only JSON.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`);
  }

  const data = await res.json();
  const raw = (data.choices?.[0]?.message?.content ?? '').trim();

  // Extract JSON even if GPT wrapped it in markdown
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('GPT did not return valid chapter JSON');

  const chapters: Chapter[] = JSON.parse(match[0]);
  // Ensure first chapter starts at 0
  if (!chapters.find(c => c.startSec === 0)) {
    chapters.unshift({ startSec: 0, title: 'Introduction' });
  }
  return chapters.sort((a, b) => a.startSec - b.startSec);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = requireAuth(request);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const lecture = lectures.getById(id);
  if (!lecture) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });

  const openaiKey  = request.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;
  const openaiModel = request.headers.get('x-openai-model') || 'gpt-4o-mini';

  if (!openaiKey) {
    return NextResponse.json({ error: 'OpenAI API key required. Set it in Admin → AI Settings.' }, { status: 400 });
  }

  try {
    let segments: Segment[];

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      // Transcribe the provided audio/video file
      const fd = await request.formData();
      const file = fd.get('audio') as File | null;
      if (!file) return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
      segments = await transcribeFile(file, openaiKey);
    } else {
      // Use already-stored segments
      segments = lecture.segments ?? [];
      if (segments.length === 0) {
        return NextResponse.json(
          { error: 'No transcript segments stored. Upload the video with the audio file to transcribe first.' },
          { status: 400 }
        );
      }
    }

    const chapters = await detectChapters(segments as WhisperSegment[], openaiKey, openaiModel);

    // Persist to DB
    lectures.update(id, { segments, chapters });

    return NextResponse.json({ success: true, chapters, segments });
  } catch (err) {
    console.error('[chapters]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Chapter detection failed' }, { status: 500 });
  }
}
