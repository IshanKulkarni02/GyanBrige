/**
 * POST /api/attendance/sessions/[id]/checkin
 *
 * A student checks in to an active session.
 * Accepts: { studentId, method, status?, proofType? }
 * Teachers can also manually check in a student.
 */
import { NextRequest, NextResponse } from 'next/server';
import { attendanceSessions, attendanceCheckins, enrollments } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

export const POST = logRoute(async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const session = attendanceSessions.getById(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.status !== 'active') return NextResponse.json({ error: 'Session is not active' }, { status: 400 });

  const caller = requireAuth(req)!;
  const body = await req.json();
  const { studentId, method = 'manual', status = 'present', proofType } = body;
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 });

  // Students may only check themselves in; teachers/admins can check in anyone
  if (caller.role === 'student' && caller.id !== studentId) {
    return NextResponse.json({ error: 'Students can only check in themselves' }, { status: 403 });
  }

  // Verify student is enrolled
  const enrollment = enrollments.get(studentId, session.courseId);
  if (!enrollment) return NextResponse.json({ error: 'Student not enrolled in this course' }, { status: 400 });

  const checkin = attendanceCheckins.upsert({
    sessionId: id,
    courseId: session.courseId,
    studentId,
    method,
    status,
    proofType,
    checkedInAt: new Date().toISOString(),
  });

  return NextResponse.json({ checkin });
});
