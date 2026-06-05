import { NextRequest, NextResponse } from 'next/server';
import { exams, examQuestions, courses, users, enrollments } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');

  let list = courseId ? exams.getByCourse(courseId) : exams.getAll();

  // Students only see active exams for enrolled courses
  if (user.role === 'student') {
    const userEnrollments = enrollments.getByUser(user.id);
    const enrolledCourseIds = new Set(userEnrollments.map(e => e.courseId));
    list = list.filter(e => e.status === 'active' && enrolledCourseIds.has(e.courseId));
  } else if (user.role === 'teacher') {
    // Teachers see exams for their courses
    list = list.filter(e => {
      const course = courses.getById(e.courseId);
      return course?.teacherId === user.id;
    });
  }

  const enriched = list.map(e => {
    const course = courses.getById(e.courseId);
    const creator = users.getById(e.createdBy);
    const questions = examQuestions.getByExam(e.id);
    return { ...e, courseName: course?.name ?? '', courseIcon: course?.icon ?? '📝', creatorName: creator?.name ?? '', questionCount: questions.length };
  });

  return NextResponse.json({ exams: enriched });
}

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { courseId, title, description, duration, totalMarks, status, startsAt, endsAt } = body;
  if (!courseId || !title) {
    return NextResponse.json({ error: 'courseId and title are required' }, { status: 400 });
  }

  const exam = exams.create({
    courseId,
    title,
    description: description ?? '',
    duration: duration ?? 60,
    totalMarks: totalMarks ?? 100,
    status: status ?? 'draft',
    createdBy: user.id,
    startsAt,
    endsAt,
  });

  return NextResponse.json({ exam }, { status: 201 });
}
