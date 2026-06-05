import { NextRequest, NextResponse } from 'next/server';
import { exams, examQuestions, courses, users } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const exam = exams.getById(id);
  if (!exam) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const questions = examQuestions.getByExam(id);
  const course = courses.getById(exam.courseId);
  const creator = users.getById(exam.createdBy);

  // Students don't see expectedAnswer
  const safeQuestions = user.role === 'student'
    ? questions.map(({ expectedAnswer: _ea, ...q }) => q)
    : questions;

  return NextResponse.json({ exam: { ...exam, questions: safeQuestions, courseName: course?.name ?? '', creatorName: creator?.name ?? '' } });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const updated = exams.update(id, body);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ exam: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const deleted = exams.delete(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
