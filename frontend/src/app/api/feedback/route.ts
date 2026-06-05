import { NextRequest, NextResponse } from 'next/server';
import { feedbackStore, courses, users, enrollments } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');

  let list;
  if (user.role === 'admin') {
    list = courseId ? feedbackStore.getByCourse(courseId) : feedbackStore.getAll();
  } else if (user.role === 'teacher') {
    list = courseId ? feedbackStore.getByCourse(courseId) : feedbackStore.getByTeacher(user.id);
  } else {
    list = feedbackStore.getByStudent(user.id);
  }

  const enriched = list.map(f => {
    const course = courses.getById(f.courseId);
    const teacher = users.getById(f.teacherId);
    const student = users.getById(f.studentId);
    return {
      ...f,
      courseName: course?.name ?? '',
      courseIcon: course?.icon ?? '📚',
      teacherName: teacher?.name ?? '',
      studentName: f.anonymous ? 'Anonymous' : (student?.name ?? ''),
    };
  });

  return NextResponse.json({ feedback: enriched });
}

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'Only students can submit feedback' }, { status: 403 });
  }

  const body = await request.json();
  const { courseId, subjectRating, teacherRating, comment, anonymous } = body;

  if (!courseId || !subjectRating || !teacherRating) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Must be enrolled
  const enrollment = enrollments.get(user.id, courseId);
  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 });
  }

  const course = courses.getById(courseId);
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  // Check duplicate
  const existing = feedbackStore.getByStudentAndCourse(user.id, courseId);
  if (existing) {
    return NextResponse.json({ error: 'Feedback already submitted for this course' }, { status: 409 });
  }

  const feedback = feedbackStore.create({
    studentId: user.id,
    courseId,
    teacherId: course.teacherId,
    subjectRating: Math.min(5, Math.max(1, Number(subjectRating))),
    teacherRating: Math.min(5, Math.max(1, Number(teacherRating))),
    comment: comment ?? '',
    anonymous: !!anonymous,
  });

  return NextResponse.json({ feedback }, { status: 201 });
}
