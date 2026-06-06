import { NextRequest, NextResponse } from 'next/server';
import { enrollments } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

// POST mark lecture as complete
export const POST = logRoute(async function POST(request: NextRequest) {
  const caller = requireAuth(request);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { userId, courseId, lectureId } = await request.json();
    if (caller.role === 'student' && caller.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!userId || !courseId || !lectureId) {
      return NextResponse.json(
        { error: 'userId, courseId, and lectureId are required' },
        { status: 400 }
      );
    }

    const updated = enrollments.updateProgress(userId, courseId, lectureId);
    
    if (!updated) {
      return NextResponse.json(
        { error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, enrollment: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}
);
