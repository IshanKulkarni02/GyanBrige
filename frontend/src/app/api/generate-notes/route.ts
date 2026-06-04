import { NextRequest, NextResponse } from 'next/server';
import { settings as dbSettings, lectures } from '@/lib/db';
import { createReadStream, existsSync, statSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Whisper hard limit per request — we split larger files into chunks
const WHISPER_CHUNK_BYTES = 24 * 1024 * 1024; // 24 MB (1 MB headroom)

/** Transcribe a single ≤24 MB audio blob — plain text */
async function transcribeChunk(blob: Blob, filename: string, openaiKey: string, language = 'auto'): Promise<string> {
  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');
  // Only hint the language when explicitly set — auto/mixed = no hint, lets Whisper
  // handle code-switching between Hindi/Marathi/English naturally
  if (language && language !== 'auto') formData.append('language', language);

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

export async function POST(request: NextRequest) {
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

      // Resolve transcript for regeneration requests
      if (!transcript && body.lectureId) {
        const lec = lectures.getById(body.lectureId);

        if (lec?.segments?.length) {
          // 1. Best case: stored Whisper segments from a previous run
          transcript = lec.segments.map((s: { text: string }) => s.text).join(' ');
          transcriptSource = 'stored';
        } else if (lec?.videoUrl && openaiKey) {
          // 2. Stream file in 24 MB chunks — never loads whole video into RAM
          const videoPath = path.join(process.cwd(), 'public', lec.videoUrl);
          if (existsSync(videoPath)) {
            const { size } = statSync(videoPath);
            const ext = path.extname(lec.videoUrl).slice(1) || 'mp4';
            const parts: string[] = [];
            let offset = 0, part = 0;
            while (offset < size) {
              const end = Math.min(offset + WHISPER_CHUNK_BYTES - 1, size - 1);
              const stream = createReadStream(videoPath, { start: offset, end });
              const chunks: Buffer[] = [];
              for await (const c of Readable.from(stream)) {
                chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
              }
              const blob = new Blob([Buffer.concat(chunks)], { type: `video/${ext}` });
              const file = new File([blob], `part${part}.${ext}`, { type: `video/${ext}` });
              parts.push(await transcribeChunk(file, `part${part}.${ext}`, openaiKey, whisperLang));
              offset += WHISPER_CHUNK_BYTES; part++;
            }
            transcript = parts.join(' ');
            transcriptSource = 'video';
            // Save as a simple segment so future regenerations are instant
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
      const response = await fetch('http://localhost:11434/api/generate', {
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
