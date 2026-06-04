import { NextRequest, NextResponse } from 'next/server';
import { quizzes } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

// GET /api/quizzes/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const quiz = quizzes.getById(id);
  if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ quiz });
}

// POST /api/quizzes/[id]/questions — add a question
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = requireAuth(request);
  if (!caller || caller.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const { question, options, correctAnswer, explanation, order } = body;
  if (!question || !options?.length) return NextResponse.json({ error: 'question and options required' }, { status: 400 });
  const q = quizzes.addQuestion(id, { question, options, correctAnswer: correctAnswer ?? 0, explanation: explanation ?? '', order: order ?? 1 });
  return NextResponse.json({ question: q });
}

// DELETE /api/quizzes/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = requireAuth(request);
  if (!caller || caller.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  quizzes.delete(id);
  return NextResponse.json({ success: true });
}
