import { NextRequest, NextResponse } from 'next/server';
import { assignments, assignmentSubmissions, users } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  if (user.role === 'student') {
    const sub = assignmentSubmissions.getByStudent(id, user.id);
    return NextResponse.json({ submission: sub ?? null });
  }

  const subs = assignmentSubmissions.getByAssignment(id);
  const enriched = subs.map(s => {
    const student = users.getById(s.studentId);
    return { ...s, studentName: student?.name ?? 'Unknown', studentEmail: student?.email ?? '' };
  });
  return NextResponse.json({ submissions: enriched });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role !== 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const assignment = assignments.getById(id);
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (assignment.status !== 'active') return NextResponse.json({ error: 'Assignment is not accepting submissions' }, { status: 400 });

  const { content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Submission content is required' }, { status: 400 });

  const submission = assignmentSubmissions.submit(id, user.id, content.trim());
  return NextResponse.json({ submission }, { status: 201 });
}
