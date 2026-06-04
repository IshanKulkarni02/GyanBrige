import { NextRequest, NextResponse } from 'next/server';
import { quizzes } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

export const DELETE = logRoute(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const caller = requireAuth(request);
  if (!caller || caller.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { qid } = await params;
  quizzes.deleteQuestion(qid);
  return NextResponse.json({ success: true });
}
);
