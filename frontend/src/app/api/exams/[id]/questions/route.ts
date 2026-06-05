import { NextRequest, NextResponse } from 'next/server';
import { examQuestions, exams } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const exam = exams.getById(id);
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

  const body = await request.json();
  const { question, maxMarks, expectedAnswer, order } = body;
  if (!question) return NextResponse.json({ error: 'question is required' }, { status: 400 });

  const existing = examQuestions.getByExam(id);
  const q = examQuestions.create({
    examId: id,
    question,
    maxMarks: maxMarks ?? 10,
    expectedAnswer: expectedAnswer ?? '',
    order: order ?? existing.length + 1,
  });

  return NextResponse.json({ question: q }, { status: 201 });
}
