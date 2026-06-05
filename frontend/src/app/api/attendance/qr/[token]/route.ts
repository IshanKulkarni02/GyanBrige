/**
 * POST /api/attendance/qr/[token]
 * Validates a QR token and checks the student in.
 * Called from the /attend/[token] page after student scans QR.
 */
import { NextRequest, NextResponse } from 'next/server';
import { attendanceSessions, attendanceCheckins, enrollments, courses } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

export const POST = logRoute(async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!requireAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { token } = await params;
  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 });

  const session = attendanceSessions.getByQrToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 });
  if (session.status !== 'active') return NextResponse.json({ error: 'Session is no longer active' }, { status: 400 });
  if (session.qrExpiresAt && new Date(session.qrExpiresAt) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  // Must be enrolled
  if (!enrollments.get(studentId, session.courseId)) {
    return NextResponse.json({ error: 'You are not enrolled in this course' }, { status: 403 });
  }

  // Already checked in?
  const existing = attendanceCheckins.getBySession(session.id).find(c => c.studentId === studentId);
  if (existing) {
    const course = courses.getById(session.courseId);
    return NextResponse.json({ error: 'already', course: course?.name }, { status: 409 });
  }

  attendanceCheckins.upsert({
    sessionId: session.id,
    courseId: session.courseId,
    studentId,
    method: 'qr',
    status: 'present',
    checkedInAt: new Date().toISOString(),
  });

  const course = courses.getById(session.courseId);
  return NextResponse.json({ success: true, course: course?.name });
});
