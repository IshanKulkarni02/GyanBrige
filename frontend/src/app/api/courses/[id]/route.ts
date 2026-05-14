import { NextRequest, NextResponse } from 'next/server';
import { courses, lectures, enrollments, users } from '@/lib/db';

// GET single course with lectures
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const course = courses.getById(id);
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const courseLectures = lectures.getByCourse(id);
    const teacher = users.getById(course.teacherId);
    const enrollment = userId ? enrollments.get(userId, id) : null;
    const enrolledStudents = enrollments.getByCourse(id);

    return NextResponse.json({
      course: {
        ...course,
        teacherName: teacher?.name || 'Unknown',
        enrolled: !!enrollment,
        progress: enrollment?.progress || 0,
        completedLectures: enrollment?.completedLectures || [],
        studentCount: enrolledStudents.length,
        lectureCount: courseLectures.length,
        lectures: courseLectures.map(l => ({
          ...l,
          duration: `${l.duration} min`,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
  }
}

// PUT update course
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = courses.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, course: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update course' }, { status: 500 });
  }
}

// DELETE course
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = courses.delete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 });
  }
}
