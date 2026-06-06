import { NextRequest, NextResponse } from 'next/server';
import { lectures, courses } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

// GET single lecture
export const GET = logRoute(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lecture = lectures.getById(id);

    if (!lecture) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    }

    return NextResponse.json({ lecture });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch lecture' }, { status: 500 });
  }
}
);

// PUT update lecture — course teacher or admin only
export const PUT = logRoute(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = requireAuth(request);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.role !== 'teacher' && caller.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const lecture = lectures.getById(id);
    if (!lecture) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    if (caller.role !== 'admin') {
      const course = courses.getById(lecture.courseId);
      if (course?.teacherId !== caller.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const updated = lectures.update(id, body);
    return NextResponse.json({ success: true, lecture: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update lecture' }, { status: 500 });
  }
}
);

// DELETE lecture — course teacher or admin only
export const DELETE = logRoute(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = requireAuth(request);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.role !== 'teacher' && caller.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const lecture = lectures.getById(id);
    if (!lecture) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    if (caller.role !== 'admin') {
      const course = courses.getById(lecture.courseId);
      if (course?.teacherId !== caller.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    lectures.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete lecture' }, { status: 500 });
  }
}
);
