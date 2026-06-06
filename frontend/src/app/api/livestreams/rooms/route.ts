import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';
import { settings, lectures } from '@/lib/db';

function real(v: string | undefined | null): string {
  // Treat absent, empty, or obviously-placeholder values as unset
  if (!v || v.startsWith('your-') || v === 'wss://your-project.livekit.cloud') return '';
  return v;
}

function getLivekitConfig() {
  const url    = real(process.env.LIVEKIT_URL)        || real(settings.get('livekit_url'))        || '';
  const key    = real(process.env.LIVEKIT_API_KEY)    || real(settings.get('livekit_api_key'))    || '';
  const secret = real(process.env.LIVEKIT_API_SECRET) || real(settings.get('livekit_api_secret')) || '';
  return { url, key, secret };
}

// In-memory room registry (survives the process, not restarts — fine for dev)
// In production, move this to the DB.
const activeRooms = new Map<string, { roomName: string; teacherId: string; startedAt: string }>();

// GET /api/livestreams/rooms?lectureId=...  — check if a room is active
export const GET = logRoute(async function GET(req: NextRequest) {
  const lectureId = req.nextUrl.searchParams.get('lectureId');
  if (!lectureId) return NextResponse.json({ error: 'lectureId required' }, { status: 400 });
  const room = activeRooms.get(lectureId) ?? null;
  return NextResponse.json({ room });
});

// POST /api/livestreams/rooms  — teacher creates/joins a room and gets a publisher token
export const POST = logRoute(async function POST(req: NextRequest) {
  const caller = requireAuth(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.role !== 'teacher' && caller.role !== 'admin') {
    return NextResponse.json({ error: 'Only teachers can start streams' }, { status: 403 });
  }

  const { lectureId, userId } = await req.json() as { lectureId: string; userId: string };
  if (!lectureId) return NextResponse.json({ error: 'lectureId required' }, { status: 400 });

  const lecture = lectures.getById(lectureId);
  if (!lecture) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });

  const { url, key, secret } = getLivekitConfig();
  if (!url || !key || !secret) {
    return NextResponse.json(
      { error: 'LiveKit not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.' },
      { status: 503 },
    );
  }

  const roomName = `lecture-${lectureId}`;
  activeRooms.set(lectureId, { roomName, teacherId: userId ?? caller.id, startedAt: new Date().toISOString() });

  const token = new AccessToken(key, secret, { identity: `teacher-${caller.id}`, ttl: '4h' });
  token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, roomAdmin: true });

  return NextResponse.json({ roomName, token: await token.toJwt(), livekitUrl: url });
});

// DELETE /api/livestreams/rooms  — teacher ends the stream
export const DELETE = logRoute(async function DELETE(req: NextRequest) {
  const caller = requireAuth(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lectureId } = await req.json() as { lectureId: string };
  activeRooms.delete(lectureId);
  return NextResponse.json({ ok: true });
});
