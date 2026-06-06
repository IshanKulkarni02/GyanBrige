import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';
import { settings } from '@/lib/db';

export const POST = logRoute(async function POST(req: NextRequest) {
  const caller = requireAuth(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lectureId, userId } = await req.json() as { lectureId: string; userId?: string };
  if (!lectureId) return NextResponse.json({ error: 'lectureId required' }, { status: 400 });

  const url    = process.env.LIVEKIT_URL        ?? settings.get('livekit_url')        ?? '';
  const key    = process.env.LIVEKIT_API_KEY    ?? settings.get('livekit_api_key')    ?? '';
  const secret = process.env.LIVEKIT_API_SECRET ?? settings.get('livekit_api_secret') ?? '';

  if (!url || !key || !secret) {
    return NextResponse.json(
      { error: 'LiveKit not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.' },
      { status: 503 },
    );
  }

  const identity = userId ?? caller.id;
  const roomName = `lecture-${lectureId}`;

  const token = new AccessToken(key, secret, { identity, ttl: '4h' });
  token.addGrant({ roomJoin: true, room: roomName, canPublish: false, canSubscribe: true });

  return NextResponse.json({ token: await token.toJwt(), livekitUrl: url });
});
