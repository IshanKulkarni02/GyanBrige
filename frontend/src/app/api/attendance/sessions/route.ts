/**
 * GET  /api/attendance/sessions?courseId=X  — list sessions for a course
 * POST /api/attendance/sessions              — start a new session (teacher)
 */
import { NextRequest, NextResponse } from 'next/server';
import { attendanceSessions, attendancePolicies, courses } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';
import QRCode from 'qrcode';

export const GET = logRoute(async function GET(req: NextRequest) {
  if (!requireAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const courseId = new URL(req.url).searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  const sessions = attendanceSessions.getByCourse(courseId);
  return NextResponse.json({ sessions });
});

export const POST = logRoute(async function POST(req: NextRequest) {
  const caller = requireAuth(req);
  if (!caller || caller.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { courseId, lectureId, title, type = 'in_person', methods = ['manual'] } = body;
  if (!courseId || !title) return NextResponse.json({ error: 'courseId and title required' }, { status: 400 });

  if (!courses.getById(courseId)) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  // End any existing active session for this course first
  const existing = attendanceSessions.getActive(courseId);
  if (existing) attendanceSessions.update(existing.id, { status: 'ended', endedAt: new Date().toISOString() });

  const date = new Date().toISOString().split('T')[0];

  // Generate QR token if QR method is enabled
  let qrToken: string | undefined;
  let qrExpiresAt: string | undefined;
  let qrDataUrl: string | undefined;
  if ((methods as string[]).includes('qr')) {
    const policy = attendancePolicies.getByCourse(courseId);
    const expiresMins = policy?.webcamCheckInterval ?? 10; // reuse interval as QR TTL for now
    qrToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
    qrExpiresAt = new Date(Date.now() + expiresMins * 60 * 1000).toISOString();
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3333';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const url = `${proto}://${host}/attend/${qrToken}`;
    qrDataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2 });
  }

  const session = attendanceSessions.create({
    courseId, lectureId, date, title,
    type, status: 'active', methods,
    qrToken, qrExpiresAt, createdBy: caller.id,
  });

  return NextResponse.json({ session, qrDataUrl }, { status: 201 });
});
