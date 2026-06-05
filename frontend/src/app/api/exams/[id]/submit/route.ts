import { NextRequest, NextResponse } from 'next/server';
import { exams, examSubmissions, examAnswers, examQuestions } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'Only students can submit exams' }, { status: 403 });
  }

  const { id } = await params;
  const exam = exams.getById(id);
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  if (exam.status !== 'active') return NextResponse.json({ error: 'Exam is not active' }, { status: 400 });

  const body = await request.json();
  // body.answers: { [questionId]: answerText }
  const { answers } = body as { answers: Record<string, string> };

  // Get or create submission
  let submission = examSubmissions.getByStudent(id, user.id);
  if (!submission) {
    submission = examSubmissions.start(id, user.id);
  }
  if (submission.status === 'submitted' || submission.status === 'marked') {
    return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
  }

  // Save all answers
  const questions = examQuestions.getByExam(id);
  for (const q of questions) {
    examAnswers.upsert({
      submissionId: submission.id,
      questionId: q.id,
      answer: answers[q.id] ?? '',
      teacherFeedback: '',
    });
  }

  const submitted = examSubmissions.submit(submission.id);
  return NextResponse.json({ submission: submitted });
}

// Start exam (GET to get existing or create)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  let submission = examSubmissions.getByStudent(id, user.id);
  if (!submission) {
    const exam = exams.getById(id);
    if (!exam || exam.status !== 'active') {
      return NextResponse.json({ error: 'Exam not available' }, { status: 400 });
    }
    submission = examSubmissions.start(id, user.id);
  }

  const answers = examAnswers.getBySubmission(submission.id);
  return NextResponse.json({ submission, answers });
}
