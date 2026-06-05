import { NextRequest, NextResponse } from 'next/server';
import { lectures, courses } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

// GET all lectures or by course
export const GET = logRoute(async function GET(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (courseId) {
      const courseLectures = lectures.getByCourse(courseId);
      return NextResponse.json({ lectures: courseLectures });
    }

    const allLectures = lectures.getAll();
    return NextResponse.json({ lectures: allLectures });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch lectures' }, { status: 500 });
  }
}
);

// POST create new lecture — teachers and admins only
export const POST = logRoute(async function POST(request: NextRequest) {
  const caller = requireAuth(request);
  if (!caller || caller.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { title, description, courseId, duration, notes, videoUrl } = body;

    // Validate required fields
    if (!title || !courseId) {
      return NextResponse.json(
        { error: 'Title and courseId are required' },
        { status: 400 }
      );
    }

    // Verify course exists
    const course = courses.getById(courseId);
    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Get current lecture count for order
    const existingLectures = lectures.getByCourse(courseId);
    const order = existingLectures.length + 1;

    // Create the lecture
    const { chapters = [], segments = [] } = body;
    const lecture = lectures.create({
      title,
      description: description || '',
      courseId,
      duration: duration || 30,
      notes: notes || '',
      videoUrl: videoUrl || undefined,
      order,
      segments,
      chapters,
    });

    return NextResponse.json({ success: true, lecture }, { status: 201 });
  } catch (error) {
    console.error('Failed to create lecture:', error);
    return NextResponse.json({ error: 'Failed to create lecture' }, { status: 500 });
  }
}
);
