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

  const real = (v: string | undefined | null) =>
    (!v || v.startsWith('your-') || v === 'wss://your-project.livekit.cloud') ? '' : v;

  const url    = real(process.env.LIVEKIT_URL)        || real(settings.get('livekit_url'))        || '';
  const key    = real(process.env.LIVEKIT_API_KEY)    || real(settings.get('livekit_api_key'))    || '';
  const secret = real(process.env.LIVEKIT_API_SECRET) || real(settings.get('livekit_api_secret')) || '';

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
