import { NextRequest, NextResponse } from 'next/server';
import { lectures, courses } from '@/lib/db';

// GET all lectures or by course
export async function GET(request: NextRequest) {
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

// POST create new lecture
export async function POST(request: NextRequest) {
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
    const lecture = lectures.create({
      title,
      description: description || '',
      courseId,
      duration: duration || 30,
      notes: notes || '',
      videoUrl: videoUrl || undefined,
      order,
    });

    return NextResponse.json({ success: true, lecture }, { status: 201 });
  } catch (error) {
    console.error('Failed to create lecture:', error);
    return NextResponse.json({ error: 'Failed to create lecture' }, { status: 500 });
  }
}
