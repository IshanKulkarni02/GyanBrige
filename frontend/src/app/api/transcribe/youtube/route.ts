/**
 * POST /api/transcribe/youtube
 * Fetch transcript from a YouTube URL without downloading the video.
 * Uses YouTube's auto-generated captions (free, instant, no Whisper cost).
 * Falls back to an error if no captions exist for the video.
 */
import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export const POST = logRoute(async function POST(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await request.json();
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

  const videoId = extractVideoId(url);
  if (!videoId) return NextResponse.json({ error: 'Could not extract video ID from URL' }, { status: 400 });

  try {
    // Try to fetch transcript — prefers Hindi/Marathi if available, else English, else auto
    let segments;
    try {
      // Try Hindi first (hi), then Marathi (mr), then auto-detect
      segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'hi' });
    } catch {
      try {
        segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'mr' });
      } catch {
        segments = await YoutubeTranscript.fetchTranscript(videoId);
      }
    }

    const transcript = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
    const durationSec = segments.length > 0 ? (segments[segments.length - 1].offset + (segments[segments.length - 1].duration ?? 0)) / 1000 : 0;

    return NextResponse.json({
      success: true,
      transcript,
      segmentCount: segments.length,
      durationSec: Math.round(durationSec),
      source: 'youtube_captions',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // YouTube returns a specific error when no captions exist
    if (msg.includes('Could not get transcripts') || msg.includes('Transcript is disabled')) {
      return NextResponse.json({
        error: 'This video has no auto-generated captions. Upload the video file instead to use Whisper transcription.',
        noCaption: true,
      }, { status: 404 });
    }
    return NextResponse.json({ error: `YouTube transcript error: ${msg}` }, { status: 500 });
  }
}
);
