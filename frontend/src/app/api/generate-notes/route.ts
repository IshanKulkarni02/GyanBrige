import { NextRequest, NextResponse } from 'next/server';

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // 25 MB — Whisper API hard limit

async function transcribeAudio(audioFile: File, openaiKey: string): Promise<string> {
  if (audioFile.size > WHISPER_MAX_BYTES) {
    throw new Error(
      `File is ${(audioFile.size / 1024 / 1024).toFixed(1)} MB — Whisper API limit is 25 MB. ` +
      'Please trim the video or extract audio before uploading.'
    );
  }

  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');

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

export async function POST(request: NextRequest) {
  try {
    const useLocalAI = request.headers.get('x-use-local-ai') === 'true';
    const ollamaModel = request.headers.get('x-ollama-model') || 'llama3:latest';
    const openaiModel = request.headers.get('x-openai-model') || 'gpt-4o-mini';
    const openaiKey = request.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;

    let title = '';
    let description = '';
    let transcript = '';
    let audioFile: File | null = null;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      title = (formData.get('title') as string) || '';
      description = (formData.get('description') as string) || '';
      audioFile = formData.get('audio') as File | null;
    } else {
      const body = await request.json();
      title = body.title || '';
      description = body.description || '';
      transcript = body.transcript || '';
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
      transcript = await transcribeAudio(audioFile, openaiKey);
    }

    // Validate Ollama path has transcript
    if (useLocalAI && audioFile && !transcript) {
      return NextResponse.json(
        { error: 'Transcription required before sending to Ollama. Provide an OpenAI key for Whisper transcription, or paste the transcript manually.' },
        { status: 400 }
      );
    }

    const prompt = `Generate comprehensive lecture notes for the following lecture:

Title: ${title}
${description ? `Description: ${description}` : ''}
${transcript ? `Transcript:\n${transcript}` : ''}

Generate well-structured notes in markdown with:
- Main topics as headings (##)
- Key points as bullet points
- Important definitions highlighted in **bold**
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
            { role: 'system', content: 'You are an expert at creating comprehensive, well-structured lecture notes.' },
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

    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error('Note generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate notes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
