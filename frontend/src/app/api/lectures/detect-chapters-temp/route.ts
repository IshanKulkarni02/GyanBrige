/**
 * POST /api/lectures/detect-chapters-temp
 *
 * Same as /api/lectures/[id]/chapters but without requiring a saved lecture.
 * Used from the upload form before the lecture has been created in the DB.
 * Transcribes + detects chapters, returns them but does NOT persist.
 */
import { NextRequest, NextResponse } from 'next/server';
import { settings as dbSettings } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export const maxDuration = 3600;

const WHISPER_CHUNK = 24 * 1024 * 1024;

async function transcribeChunk(blob: Blob, filename: string, openaiKey: string) {
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'segment');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${openaiKey}` }, body: fd,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `Whisper ${res.status}`); }
  const d = await res.json() as { segments?: { start:number; end:number; text:string }[] };
  return d.segments ?? [];
}

async function transcribeFile(file: File, openaiKey: string) {
  if (file.size <= WHISPER_CHUNK) return transcribeChunk(file, file.name, openaiKey);
  const ext = file.name.split('.').pop() ?? 'mp4';
  const all: { start:number; end:number; text:string }[] = [];
  let offset = 0, part = 0, timeOffset = 0;
  while (offset < file.size) {
    const segs = await transcribeChunk(file.slice(offset, offset + WHISPER_CHUNK), `part${part}.${ext}`, openaiKey);
    const dur = segs.length ? segs[segs.length - 1].end : 0;
    all.push(...segs.map(s => ({ ...s, start: s.start + timeOffset, end: s.end + timeOffset })));
    timeOffset += dur; offset += WHISPER_CHUNK; part++;
  }
  return all;
}

export async function POST(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const s = dbSettings.getAll();
  const openaiKey   = s.openaiKey   || process.env.OPENAI_API_KEY;
  const openaiModel = s.openaiModel || 'gpt-4o-mini';

  if (!openaiKey) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured. Set it in Admin → AI Settings.' },
      { status: 400 }
    );
  }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) return NextResponse.json({ error: 'Send audio file as multipart' }, { status: 400 });

  const fd   = await request.formData();
  const file = fd.get('audio') as File | null;
  if (!file) return NextResponse.json({ error: 'No audio file' }, { status: 400 });

  try {
    const segments = await transcribeFile(file, openaiKey);
    if (!segments.length) return NextResponse.json({ chapters: [{ startSec: 0, title: 'Introduction' }], segments: [] });

    const totalDuration = segments[segments.length - 1]?.end ?? 0;
    const formatted = segments.map(s => {
      const m = Math.floor(s.start / 60).toString().padStart(2, '0');
      const sec = Math.floor(s.start % 60).toString().padStart(2, '0');
      return `[${m}:${sec}] ${s.text.trim()}`;
    }).join('\n');

    const prompt = `Create YouTube-style chapter markers for this lecture (${Math.round(totalDuration / 60)} min).
First chapter always starts at 0 titled "Introduction". 3-8 chapters, 2-5 word titles, min 90s per chapter.

${formatted.slice(0, 12000)}

Return ONLY JSON: [{"startSec":0,"title":"Introduction"},...]`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: openaiModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500, temperature: 0.2,
      }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `OpenAI ${res.status}`); }
    const data = await res.json();
    const raw   = (data.choices?.[0]?.message?.content ?? '').trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('GPT returned invalid chapter JSON');

    const chapters = JSON.parse(match[0]) as { startSec: number; title: string }[];
    if (!chapters.find(c => c.startSec === 0)) chapters.unshift({ startSec: 0, title: 'Introduction' });

    return NextResponse.json({ chapters: chapters.sort((a, b) => a.startSec - b.startSec), segments });
  } catch (err) {
    console.error('[detect-chapters-temp]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Chapter detection failed' }, { status: 500 });
  }
}
