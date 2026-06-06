import { NextRequest, NextResponse } from 'next/server';
import { assignmentSubmissions, assignments, courses } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, subId } = await params;

  const assignment = assignments.getById(id);
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (user.role === 'teacher') {
    const course = courses.getById(assignment.courseId);
    if (course?.teacherId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { marksAwarded, feedback } = await request.json();
  if (marksAwarded == null) return NextResponse.json({ error: 'marksAwarded is required' }, { status: 400 });

  const updated = assignmentSubmissions.grade(subId, Number(marksAwarded), feedback ?? '');
  if (!updated) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

  return NextResponse.json({ submission: updated });
}
