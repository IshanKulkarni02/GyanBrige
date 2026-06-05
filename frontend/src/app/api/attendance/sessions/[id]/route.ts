/**
 * GET /api/attendance/sessions/[id]  — session detail + live check-in list
 * PUT /api/attendance/sessions/[id]  — update session (end it, refresh QR, etc.)
 */
import { NextRequest, NextResponse } from 'next/server';
import { attendanceSessions, attendanceCheckins, users, enrollments } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';
import QRCode from 'qrcode';

export const GET = logRoute(async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const session = attendanceSessions.getById(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const checkins = attendanceCheckins.getBySession(id);
  // Enrich with student names
  const enriched = checkins.map(c => {
    const u = users.getById(c.studentId);
    return { ...c, studentName: u?.name ?? 'Unknown', studentEmail: u?.email ?? '' };
  });

  // All enrolled students (for "not-checked-in" list)
  const enrolled = enrollments.getByCourse(session.courseId)
    .map(e => {
      const u = users.getById(e.userId);
      const checkin = checkins.find(c => c.studentId === e.userId);
      return { id: e.userId, name: u?.name ?? 'Unknown', email: u?.email ?? '', checkin: checkin ?? null };
    });

  return NextResponse.json({ session, checkins: enriched, students: enrolled });
});

export const PUT = logRoute(async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = requireAuth(req);
  if (!caller || caller.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const session = attendanceSessions.getById(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.status === 'ended') {
    updates.status = 'ended';
    updates.endedAt = new Date().toISOString();
    // Write checkins back to the legacy attendance table for backward compatibility
    const { attendance } = await import('@/lib/db');
    const checkins = attendanceCheckins.getBySession(id);
    const records: Record<string, 'present' | 'absent' | 'late' | 'remote'> = {};
    // Start everyone as absent
    enrollments.getByCourse(session.courseId).forEach(e => { records[e.userId] = 'absent'; });
    checkins.forEach(c => {
      records[c.studentId] = c.status as 'present' | 'remote' | 'late';
    });
    attendance.mark(session.courseId, session.date, records, caller.id);
  }

  if (body.refreshQr) {
    const expiresMins = 10;
    updates.qrToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
    updates.qrExpiresAt = new Date(Date.now() + expiresMins * 60 * 1000).toISOString();
  }

  if (body.title) updates.title = body.title;
  if (body.type) updates.type = body.type;
  if (body.methods) updates.methods = body.methods;

  const updated = attendanceSessions.update(id, updates as Partial<typeof session>);

  // Return new QR data URL if token was refreshed
  let qrDataUrl: string | undefined;
  if (updates.qrToken) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || process.env.NEXT_PUBLIC_QR_HOST || 'localhost:3333';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    qrDataUrl = await QRCode.toDataURL(`${proto}://${host}/attend/${updates.qrToken}`, { width: 256, margin: 2 });
  }

  return NextResponse.json({ session: updated, qrDataUrl });
});
