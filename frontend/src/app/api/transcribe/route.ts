import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

export const POST = logRoute(async function POST(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const openaiKey = request.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 });
    }

    const whisperFormData = new FormData();
    whisperFormData.append('file', file);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: whisperFormData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Whisper API error:', error);
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, transcript: data.text || '' });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
);
