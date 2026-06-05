import { NextRequest, NextResponse } from 'next/server';
import { settings as dbSettings, lectures } from '@/lib/db';
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

// Whisper hard limit per request — we split larger files into chunks
const WHISPER_CHUNK_BYTES = 24 * 1024 * 1024; // 24 MB (1 MB headroom)

/** Use ffmpeg to extract 16 kHz mono MP3 from any video/audio file. */
async function extractAudio(videoPath: string): Promise<string> {
  const tmpAudio = path.join(tmpdir(), `gyanbrige-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-vn', '-ar', '16000', '-ac', '1',
    '-acodec', 'libmp3lame', '-q:a', '4',
    '-y', tmpAudio,
  ]);
  return tmpAudio;
}

/** Transcribe a server-side video file via ffmpeg → Whisper (chunked if needed). */
async function transcribeVideoFile(videoPath: string, openaiKey: string, language = 'auto'): Promise<string> {
  const audioPath = await extractAudio(videoPath);
  try {
    const { size } = statSync(audioPath);
    const parts: string[] = [];
    let offset = 0, part = 0;
    while (offset < size) {
      const end = Math.min(offset + WHISPER_CHUNK_BYTES - 1, size - 1);
      const stream = createReadStream(audioPath, { start: offset, end });
      const bufs: Buffer[] = [];
      for await (const c of Readable.from(stream)) bufs.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      const blob = new Blob([Buffer.concat(bufs)], { type: 'audio/mpeg' });
      const fd = new FormData();
      fd.append('file', blob, `part${part}.mp3`);
      fd.append('model', 'whisper-1');
      fd.append('response_format', 'text');
      if (language && language !== 'auto') fd.append('language', language);
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${openaiKey}` }, body: fd,
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `Whisper ${res.status}`); }
      parts.push(await res.text());
      offset += WHISPER_CHUNK_BYTES; part++;
    }
    return parts.join(' ');
  } finally {
    await unlink(audioPath).catch(() => {});
  }
}

/** Transcribe a single ≤24 MB audio blob — plain text */
async function transcribeChunk(blob: Blob, filename: string, openaiKey: string, language = 'auto'): Promise<string> {
  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');
  // Only hint the language when explicitly set — auto/mixed = no hint, lets Whisper
  // handle code-switching between Hindi/Marathi/English naturally
  if (language && language !== 'auto') formData.append('language', language);

  return withRetry(async () => {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Whisper API error ${response.status}`);
    }
    return response.text();
  }, 3, 3000, `Whisper chunk ${filename}`);
}

/**
 * Transcribe any size audio/video file.
 * Files larger than 24 MB are split into binary chunks and transcribed
 * sequentially. Whisper handles mid-audio splits well for speech.
 */
async function transcribeAudio(audioFile: File, openaiKey: string, language = 'auto'): Promise<string> {
  if (audioFile.size <= WHISPER_CHUNK_BYTES) {
    return transcribeChunk(audioFile, audioFile.name || 'audio.mp4', openaiKey, language);
  }

  const ext = (audioFile.name.split('.').pop() || 'mp4').toLowerCase();
  const parts: string[] = [];
  let offset = 0, part = 0;

  while (offset < audioFile.size) {
    const chunk = audioFile.slice(offset, offset + WHISPER_CHUNK_BYTES);
    const partTranscript = await transcribeChunk(chunk, `part${part}.${ext}`, openaiKey, language);
    parts.push(partTranscript.trim());
    offset += WHISPER_CHUNK_BYTES;
    part++;
  }

  return parts.join(' ');
}

export const POST = logRoute(async function POST(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    // Read AI settings from DB (server-side); fall back to env var
    const storedSettings = dbSettings.getAll();
    const useLocalAI   = storedSettings.useLocalAI === 'true';
    const ollamaModel  = storedSettings.ollamaModel || request.headers.get('x-ollama-model') || 'llama3:latest';
    const openaiModel  = storedSettings.openaiModel || request.headers.get('x-openai-model') || 'gpt-4o-mini';
    const openaiKey    = storedSettings.openaiKey   || process.env.OPENAI_API_KEY;
    const whisperLang  = storedSettings.transcriptionLanguage || 'auto';

    let title = '';
    let description = '';
    let transcript = '';
    let audioFile: File | null = null;
    let transcriptSource: 'stored' | 'video' | 'audio_upload' | 'none' = 'none';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      title = (formData.get('title') as string) || '';
      description = (formData.get('description') as string) || '';
      audioFile = formData.get('audio') as File | null;
    } else {
      const body = await request.json();
      title       = body.title       || '';
      description = body.description || '';
      transcript  = body.transcript  || '';

      // If caller passes a server-side video path, extract audio via ffmpeg then transcribe
      if (!transcript && body.videoUrl && openaiKey) {
        const videoPath = path.join(process.cwd(), 'public', body.videoUrl as string);
        if (existsSync(videoPath)) {
          transcript = await transcribeVideoFile(videoPath, openaiKey, whisperLang);
          transcriptSource = 'video';
          if (transcript && body.lectureId) {
            lectures.update(body.lectureId as string, {
              segments: [{ start: 0, end: 0, text: transcript }],
            });
          }
        }
      }

      // Resolve transcript for regeneration requests
      if (!transcript && body.lectureId) {
        const lec = lectures.getById(body.lectureId);

        if (lec?.segments?.length) {
          // 1. Best case: stored Whisper segments from a previous run
          transcript = lec.segments.map((s: { text: string }) => s.text).join(' ');
          transcriptSource = 'stored';
        } else if (lec?.videoUrl && openaiKey) {
          // 2. Extract audio via ffmpeg, then transcribe with Whisper
          const videoPath = path.join(process.cwd(), 'public', lec.videoUrl);
          if (existsSync(videoPath)) {
            transcript = await transcribeVideoFile(videoPath, openaiKey, whisperLang);
            transcriptSource = 'video';
            if (transcript) {
              lectures.update(lec.id, {
                segments: [{ start: 0, end: lec.duration * 60, text: transcript }],
              });
            }
          }
        }
        // 3. Fallback: title + description only (transcriptSource stays 'none')
      }
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Transcribe audio if provided and using OpenAI
    if (!useLocalAI && audioFile) {
      if (!openaiKey) {
        return NextResponse.json(
          { error: 'OpenAI API key not configured. Set it in Admin → AI Settings.' },
          { status: 400 }
        );
      }
      // Large files are automatically split into 24 MB chunks
      transcript = await transcribeAudio(audioFile, openaiKey, whisperLang);
      transcriptSource = 'audio_upload';
    }

    // Ollama path requires a pre-built transcript
    if (useLocalAI && audioFile && !transcript) {
      return NextResponse.json(
        {
          error:
            'Transcription required before sending to Ollama. Provide an OpenAI key for Whisper transcription, or paste the transcript manually.',
        },
        { status: 400 }
      );
    }

    const prompt = `Generate comprehensive lecture notes for the following lecture.

LANGUAGE RULE: The lecture may be in English, Hindi, Marathi, or a mix of these (e.g. Hinglish, Marathi-English). Write the notes in the EXACT SAME LANGUAGE(S) as the transcript — do NOT translate. If the teacher switched between Hindi and English, write the notes the same way.

Title: ${title}
${description ? `Description: ${description}` : ''}
${transcript ? `Transcript:\n${transcript.slice(0, 12000)}` : ''}

Structure:
- ## Headings for main topics
- Bullet points for key concepts
- **Bold** for important terms/definitions
- Summary section at the end

Notes:`;

    let notes = '';

    if (useLocalAI) {
      const ollamaBase = process.env.OLLAMA_API_URL ?? 'http://localhost:11434';
      const response = await fetch(`${ollamaBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaModel, prompt, stream: false }),
      });
      if (!response.ok) {
        const status = response.status;
        throw new Error(
          status === 404
            ? `Ollama model "${ollamaModel}" not found. Run: ollama pull ${ollamaModel}`
            : `Ollama error ${status}. Make sure Ollama is running on port 11434.`
        );
      }
      const data = await response.json();
      notes = data.response || '';
      if (!notes) throw new Error('Ollama returned an empty response.');
    } else {
      if (!openaiKey) {
        return NextResponse.json(
          { error: 'OpenAI API key not configured. Set it in Admin → AI Settings.' },
          { status: 400 }
        );
      }
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating comprehensive, well-structured lecture notes.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 2000,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `OpenAI API error ${response.status}`);
      }
      const data = await response.json();
      notes = data.choices?.[0]?.message?.content || '';
      if (!notes) throw new Error('OpenAI returned an empty response.');
    }

    return NextResponse.json({ success: true, notes, transcriptSource });
  } catch (error) {
    console.error('Note generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate notes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
);
