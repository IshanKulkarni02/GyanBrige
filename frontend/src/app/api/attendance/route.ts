import { NextRequest, NextResponse } from 'next/server';
import { attendance } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

// GET attendance records
export const GET = logRoute(async function GET(request: NextRequest) {
  const caller = requireAuth(request);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const date = searchParams.get('date');

    if (courseId && date) {
      const record = attendance.getByDate(courseId, date);
      return NextResponse.json({ attendance: record || null });
    }

    if (courseId) {
      const records = attendance.getByCourse(courseId);
      return NextResponse.json({ attendance: records });
    }

    if (!requireAdmin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ attendance: attendance.getAll() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}
);

// POST mark attendance — teachers and admins only
export const POST = logRoute(async function POST(request: NextRequest) {
  const caller = requireAuth(request);
  if (!caller || caller.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { courseId, date, records, markedBy } = body;

    if (!courseId || !date || !records || !markedBy) {
      return NextResponse.json(
        { error: 'courseId, date, records, and markedBy are required' },
        { status: 400 }
      );
    }

    const attendanceRecord = attendance.mark(courseId, date, records, markedBy);
    return NextResponse.json({ success: true, attendance: attendanceRecord });
  } catch (error) {
    console.error('Failed to mark attendance:', error);
    return NextResponse.json({ error: 'Failed to mark attendance' }, { status: 500 });
  }
}
);
