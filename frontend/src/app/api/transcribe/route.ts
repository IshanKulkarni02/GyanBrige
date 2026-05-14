import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get OpenAI key from header or env
    const openaiKey = request.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;
    
    if (!openaiKey) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        transcript: '' 
      }, { status: 200 });
    }

    // Create form data for Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', file);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: whisperFormData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Whisper API error:', error);
      return NextResponse.json({ 
        error: 'Transcription failed',
        transcript: '' 
      }, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json({ 
      success: true, 
      transcript: data.text || '' 
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ 
      error: 'Transcription failed',
      transcript: '' 
    }, { status: 200 });
  }
}
