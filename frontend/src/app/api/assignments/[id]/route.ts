import { NextRequest, NextResponse } from 'next/server';
import { assignments, courses } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const assignment = assignments.getById(id);
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const course = courses.getById(assignment.courseId);
  return NextResponse.json({ assignment: { ...assignment, courseName: course?.name ?? '', courseIcon: course?.icon ?? '📋' } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const assignment = assignments.getById(id);
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const course = courses.getById(assignment.courseId);
  if (user.role === 'teacher' && course?.teacherId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updated = assignments.update(id, body);
  return NextResponse.json({ assignment: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  assignments.delete(id);
  return NextResponse.json({ ok: true });
}
