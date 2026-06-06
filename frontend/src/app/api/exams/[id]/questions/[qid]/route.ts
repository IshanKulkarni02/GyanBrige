import { NextRequest, NextResponse } from 'next/server';
import { examQuestions } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; qid: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { qid } = await params;
  const deleted = examQuestions.delete(qid);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
