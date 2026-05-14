import { NextRequest, NextResponse } from 'next/server';
import { enrollments } from '@/lib/db';

// POST mark lecture as complete
export async function POST(request: NextRequest) {
  try {
    const { userId, courseId, lectureId } = await request.json();

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
