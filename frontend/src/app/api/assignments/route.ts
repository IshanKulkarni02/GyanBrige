import { NextRequest, NextResponse } from 'next/server';
import { assignments, courses, enrollments } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');

  let list = courseId ? assignments.getByCourse(courseId) : assignments.getAll();

  if (user.role === 'student') {
    const userEnrollments = enrollments.getByUser(user.id);
    const enrolledCourseIds = new Set(userEnrollments.map(e => e.courseId));
    list = list.filter(a => a.status === 'active' && enrolledCourseIds.has(a.courseId));
  } else if (user.role === 'teacher') {
    list = list.filter(a => {
      const course = courses.getById(a.courseId);
      return course?.teacherId === user.id;
    });
  }

  const enriched = list.map(a => {
    const course = courses.getById(a.courseId);
    return { ...a, courseName: course?.name ?? '', courseIcon: course?.icon ?? '📋' };
  });

  return NextResponse.json({ assignments: enriched });
}

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { courseId, title, description, dueDate, totalMarks, status } = body;
  if (!courseId || !title) {
    return NextResponse.json({ error: 'courseId and title are required' }, { status: 400 });
  }

  const assignment = assignments.create({
    courseId,
    title,
    description: description ?? '',
    dueDate: dueDate ?? undefined,
    totalMarks: totalMarks ?? 100,
    status: status ?? 'active',
    createdBy: user.id,
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
