import { NextRequest, NextResponse } from 'next/server';
import { courses, lectures, enrollments, users } from '@/lib/db';

// GET all courses or courses for a specific teacher
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const userId = searchParams.get('userId');

    let courseList = teacherId ? courses.getByTeacher(teacherId) : courses.getAll();

    // Enrich with lecture count and teacher info
    const enrichedCourses = courseList.map(course => {
      const courseLectures = lectures.getByCourse(course.id);
      const teacher = users.getById(course.teacherId);
      const enrolled = userId ? enrollments.get(userId, course.id) : null;

      return {
        ...course,
        lectureCount: courseLectures.length,
        teacherName: teacher?.name || 'Unknown',
        enrolled: !!enrolled,
        progress: enrolled?.progress || 0,
      };
    });

    return NextResponse.json({ courses: enrichedCourses });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
  }
}

// POST create new course
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, icon, color, teacherId } = body;

    if (!name || !teacherId) {
      return NextResponse.json(
        { error: 'Name and teacherId are required' },
        { status: 400 }
      );
    }

    const newCourse = courses.create({
      name,
      description: description || '',
      icon: icon || '📚',
      color: color || 'from-emerald-500 to-teal-500',
      teacherId,
    });

    return NextResponse.json({ success: true, course: newCourse });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 });
  }
}
