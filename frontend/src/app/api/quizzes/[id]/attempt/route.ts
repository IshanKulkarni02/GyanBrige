/**
 * GET /api/quizzes/[id]/attempt?userId=X  — fetch a student's previous attempt
 * POST /api/quizzes/[id]/attempt           — submit answers (idempotent: re-submit overwrites)
 *
 * On a passing submission we also auto-mark the student as "remote present"
 * in any active attendance session for this course (quiz = proof of attention).
 */
import { NextRequest, NextResponse } from 'next/server';
import { quizzes, quizAttempts, attendanceSessions, attendanceCheckins, attendancePolicies, enrollments } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

const PASS_THRESHOLD = 0.6; // 60% correct = pass

export const GET = logRoute(async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const attempt = quizAttempts.getByUser(id, userId);
  return NextResponse.json({ attempt: attempt ?? null });
});

export const POST = logRoute(async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = requireAuth(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.role !== 'student') return NextResponse.json({ error: 'Only students submit quiz attempts' }, { status: 403 });

  const { id } = await params;
  const quiz = quizzes.getById(id);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  const body = await req.json();
  const { answers } = body as { answers: Record<number, number> };
  if (!answers || typeof answers !== 'object') return NextResponse.json({ error: 'answers required' }, { status: 400 });

  const questions = quiz.questions ?? [];
  let score = 0;
  questions.forEach((q, i) => { if (answers[i] === q.correctAnswer) score++; });
  const passed = questions.length > 0 && (score / questions.length) >= PASS_THRESHOLD;

  const attempt = quizAttempts.submit({
    quizId: id,
    userId: caller.id,
    answers,
    score,
    total: questions.length,
    passed,
    submittedAt: new Date().toISOString(),
  });

  // ── If passed, auto-check-in as "remote" in the active attendance session ──
  let attendanceCheckin = null;
  if (passed && quiz.courseId) {
    const policy = attendancePolicies.getByCourse(quiz.courseId);
    const proofOk = !policy || policy.proofType === 'none' || policy.proofType === 'quiz' || policy.proofType === 'either';
    if (proofOk) {
      const activeSession = attendanceSessions.getActive(quiz.courseId);
      if (activeSession) {
        const enrolled = enrollments.get(caller.id, quiz.courseId);
        if (enrolled) {
          attendanceCheckin = attendanceCheckins.upsert({
            sessionId: activeSession.id,
            courseId: quiz.courseId,
            studentId: caller.id,
            method: 'online',
            status: 'remote',
            proofType: 'quiz',
            checkedInAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  return NextResponse.json({ attempt, attendanceCheckin });
});
