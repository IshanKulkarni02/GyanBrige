import { NextRequest, NextResponse } from 'next/server';
import { examSubmissions, examAnswers, examQuestions } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sid } = await params;
  const submission = examSubmissions.getById(sid);
  if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

  const body = await request.json();
  // body.marks: { [answerId]: { marks: number, feedback: string } }
  const { marks } = body as { marks: Record<string, { marks: number; feedback: string }> };

  const answers = examAnswers.getBySubmission(sid);
  let total = 0;

  for (const answer of answers) {
    const m = marks[answer.id];
    if (m !== undefined) {
      const q = examQuestions.getById(answer.questionId);
      const awarded = Math.min(q?.maxMarks ?? 999, Math.max(0, m.marks));
      examAnswers.upsert({
        ...answer,
        marksAwarded: awarded,
        teacherFeedback: m.feedback ?? '',
      });
      total += awarded;
    } else if (answer.marksAwarded != null) {
      total += answer.marksAwarded;
    }
  }

  const updated = examSubmissions.mark(sid, total);
  return NextResponse.json({ submission: updated, totalMarks: total });
}
