import { NextRequest, NextResponse } from 'next/server';
import { timetable, courses, users } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  const teacherId = searchParams.get('teacherId');

  let entries = courseId
    ? timetable.getByCourse(courseId)
    : teacherId
    ? timetable.getByTeacher(teacherId)
    : timetable.getAll();

  // Enrich with course and teacher names
  const enriched = entries.map(e => {
    const course = courses.getById(e.courseId);
    const teacher = users.getById(e.teacherId);
    return { ...e, courseName: course?.name ?? '', courseIcon: course?.icon ?? '📚', courseColor: course?.color ?? '', teacherName: teacher?.name ?? '' };
  });

  return NextResponse.json({ entries: enriched });
}

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { courseId, teacherId, day, startTime, endTime, room } = body;
  if (!courseId || !teacherId || !day || !startTime || !endTime) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const entry = timetable.create({ courseId, teacherId, day, startTime, endTime, room: room ?? '' });
  return NextResponse.json({ entry }, { status: 201 });
}
