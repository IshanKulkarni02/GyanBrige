import { NextRequest, NextResponse } from 'next/server';

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(audioFile: File, openaiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Transcription failed');
  }

  return await response.text();
}

// Generate notes using AI
export async function POST(request: NextRequest) {
  try {
    // Get AI settings from request headers (passed from client localStorage)
    const useLocalAI = request.headers.get('x-use-local-ai') === 'true';
    const ollamaModel = request.headers.get('x-ollama-model') || 'llama2';
    const openaiModel = request.headers.get('x-openai-model') || 'gpt-4o-mini';
    const openaiKey = request.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;
    
    let title = '';
    let description = '';
    let transcript = '';
    let audioFile: File | null = null;
    
    // Check if request is FormData (audio file) or JSON
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // FormData with audio file (for ChatGPT)
      const formData = await request.formData();
      title = formData.get('title') as string || '';
      description = formData.get('description') as string || '';
      audioFile = formData.get('audio') as File | null;
    } else {
      // JSON with transcript (for Ollama)
      const body = await request.json();
      title = body.title || '';
      description = body.description || '';
      transcript = body.transcript || '';
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    
    // If using OpenAI with audio, transcribe first
    if (!useLocalAI && audioFile && openaiKey) {
      try {
        transcript = await transcribeAudio(audioFile, openaiKey);
      } catch (err) {
        console.error('Transcription error:', err);
      }
    }

    const prompt = `Generate comprehensive lecture notes for the following lecture:

Title: ${title}
${description ? `Description: ${description}` : ''}
${transcript ? `Transcript: ${transcript}` : ''}

Please generate well-structured notes in markdown format with:
- Main topics as headings
- Key points as bullet points
- Important definitions highlighted
- Summary at the end

Notes:`;

    let notes = '';

    if (useLocalAI) {
      // Use Ollama (local)
      try {
        const response = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            prompt: prompt,
            stream: false,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          notes = data.response || generateFallbackNotes(title, description);
        } else {
          notes = generateFallbackNotes(title, description);
        }
      } catch {
        // Ollama not available, use fallback
        notes = generateFallbackNotes(title, description);
      }
    } else if (openaiKey) {
      // Use OpenAI
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: openaiModel,
            messages: [
              { role: 'system', content: 'You are a helpful assistant that creates comprehensive lecture notes.' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 2000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          notes = data.choices?.[0]?.message?.content || generateFallbackNotes(title, description);
        } else {
          notes = generateFallbackNotes(title, description);
        }
      } catch {
        notes = generateFallbackNotes(title, description);
      }
    } else {
      // No AI configured, use fallback
      notes = generateFallbackNotes(title, description);
    }

    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error('Note generation error:', error);
    return NextResponse.json({ error: 'Failed to generate notes' }, { status: 500 });
  }
}

function generateFallbackNotes(title: string, description?: string): string {
  return `# ${title}

## Overview
${description || 'This lecture covers important concepts and topics.'}

## Key Points
- Main concept 1
- Main concept 2
- Main concept 3

## Topics Covered
### Topic 1
- Important detail
- Key takeaway

### Topic 2
- Important detail
- Key takeaway

## Summary
This lecture provided an introduction to ${title.toLowerCase()}. Review the key points above and practice applying these concepts.

## Additional Notes
- Add your own notes here
- Review related materials

---
*Notes auto-generated by GyanBrige AI*`;
}
