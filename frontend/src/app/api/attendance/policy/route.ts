/**
 * GET /api/attendance/policy?courseId=X  — get policy for a course
 * PUT /api/attendance/policy?courseId=X  — upsert policy (admin or teacher)
 */
import { NextRequest, NextResponse } from 'next/server';
import { attendancePolicies } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

export const GET = logRoute(async function GET(req: NextRequest) {
  if (!requireAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const courseId = new URL(req.url).searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  const policy = attendancePolicies.getByCourse(courseId);
  if (!policy) {
    // Return defaults
    return NextResponse.json({
      policy: {
        courseId, minAttendancePercent: 75, remoteAllowPercent: 30,
        requireProofForOnline: true, proofType: 'either', webcamCheckInterval: 15,
        allowedMethods: ['manual', 'network', 'qr', 'online'],
      }
    });
  }
  return NextResponse.json({ policy });
});

export const PUT = logRoute(async function PUT(req: NextRequest) {
  const caller = requireAuth(req);
  if (!caller || caller.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const courseId = new URL(req.url).searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  const body = await req.json();
  const policy = attendancePolicies.upsert(courseId, body);
  return NextResponse.json({ policy });
});
