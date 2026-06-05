import { NextRequest, NextResponse } from 'next/server';
import { examSubmissions, examAnswers, users } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const submissions = examSubmissions.getByExam(id);

  const enriched = submissions.map(s => {
    const student = users.getById(s.studentId);
    const answers = examAnswers.getBySubmission(s.id);
    return { ...s, studentName: student?.name ?? 'Unknown', studentEmail: student?.email ?? '', answers };
  });

  return NextResponse.json({ submissions: enriched });
}
