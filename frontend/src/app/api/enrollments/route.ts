import { NextRequest, NextResponse } from 'next/server';
import { enrollments, courses, lectures, users } from '@/lib/db';

// GET enrollments for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const courseId = searchParams.get('courseId');

    if (courseId) {
      // Get all students enrolled in a course
      const courseEnrollments = enrollments.getByCourse(courseId);
      const enriched = courseEnrollments.map(e => {
        const user = users.getById(e.userId);
        return {
          ...e,
          userId: e.userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          userMacAddress: user?.macAddress ?? null,
        };
      });
      return NextResponse.json({ enrollments: enriched });
    }

    if (userId) {
      // Get all courses a user is enrolled in
      const userEnrollments = enrollments.getByUser(userId);
      const enriched = userEnrollments.map(e => {
        const course = courses.getById(e.courseId);
        const courseLectures = lectures.getByCourse(e.courseId);
        return {
          ...e,
          course: course ? {
            ...course,
            lectureCount: courseLectures.length,
          } : null,
        };
      });
      return NextResponse.json({ enrollments: enriched });
    }

    return NextResponse.json({ error: 'userId or courseId required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
  }
}

// POST enroll in a course
export async function POST(request: NextRequest) {
  try {
    const { userId, courseId } = await request.json();

    if (!userId || !courseId) {
      return NextResponse.json(
        { error: 'userId and courseId are required' },
        { status: 400 }
      );
    }

    const enrollment = enrollments.enroll(userId, courseId);
    return NextResponse.json({ success: true, enrollment });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to enroll' }, { status: 500 });
  }
}

// DELETE unenroll from a course
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const courseId = searchParams.get('courseId');

    if (!userId || !courseId) {
      return NextResponse.json(
        { error: 'userId and courseId are required' },
        { status: 400 }
      );
    }

    const success = enrollments.unenroll(userId, courseId);
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to unenroll' }, { status: 500 });
  }
}
