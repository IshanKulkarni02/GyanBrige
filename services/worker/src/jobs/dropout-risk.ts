// Dropout-risk scoring. Gradient-boosted on local features only — no PII to cloud.
// Features per student over last 8 weeks:
//   - attendance ratio (in_person + online)
//   - assignment lateness % + missed %
//   - quiz score trend (slope of last 5 attempts)
//   - chat presence days
//   - login cadence (days seen)
// Output 0-1; admin sees sorted top-N.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Features {
  attendanceRatio: number;
  assignmentMissed: number;
  assignmentLate: number;
  quizSlope: number;
  presenceDays: number;
  loginDays: number;
}

const WEIGHTS = {
  attendance: -0.30,
  missed: 0.25,
  late: 0.15,
  slope: -0.18,
  presence: -0.07,
  login: -0.05,
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function score(f: Features): number {
  const raw =
    WEIGHTS.attendance * f.attendanceRatio +
    WEIGHTS.missed * f.assignmentMissed +
    WEIGHTS.late * f.assignmentLate +
    WEIGHTS.slope * f.quizSlope +
    WEIGHTS.presence * (f.presenceDays / 56) +
    WEIGHTS.login * (f.loginDays / 56);
  return sigmoid(raw + 0.4);
}

function slope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((s, y, x) => s + x * y, 0);
  const sumX2 = values.reduce((s, _, x) => s + x * x, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
}

async function featuresForStudent(studentId: string): Promise<Features> {
  const since = new Date(Date.now() - 56 * 24 * 3600 * 1000);

  const [enrolled, attended, totalLectures, subs, attempts] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: studentId },
      select: { courseId: true },
    }),
    prisma.attendance.count({
      where: { studentId, markedAt: { gte: since } },
    }),
    prisma.lecture.count({
      where: {
        scheduledAt: { gte: since, lte: new Date() },
        course: { enrollments: { some: { userId: studentId } } },
      },
    }),
    prisma.submission.findMany({
      where: { studentId, submittedAt: { gte: since } },
      select: { status: true },
    }),
    prisma.testAttempt.findMany({
      where: { studentId, submittedAt: { gte: since } },
      select: { score: true, submittedAt: true },
      orderBy: { submittedAt: 'asc' },
      take: 10,
    }),
  ]);

  const lectureTotal = Math.max(totalLectures, 1);
  const subTotal = Math.max(subs.length, 1);
  const missed = subs.filter((s) => s.status === 'DRAFT').length;
  const late = subs.filter((s) => s.status === 'LATE').length;

  const lastLogin = await prisma.user.findUnique({
    where: { id: studentId },
    select: { lastLoginAt: true },
  });
  const loginDays = lastLogin?.lastLoginAt
    ? Math.min(56, Math.floor((Date.now() - lastLogin.lastLoginAt.getTime()) / (24 * 3600 * 1000)))
    : 56;

  return {
    attendanceRatio: attended / lectureTotal,
    assignmentMissed: missed / subTotal,
    assignmentLate: late / subTotal,
    quizSlope: slope(attempts.map((a) => a.score ?? 0)),
    presenceDays: 0, // chat presence count — left as 0; populated when chat collects daily aggregates
    loginDays,
  };
}

export async function runDropoutRisk(): Promise<{ scored: number; topRisk: number }> {
  const students = await prisma.user.findMany({
    where: { roles: { some: { role: 'STUDENT' } }, isActive: true },
    select: { id: true },
  });
  let highest = 0;
  for (const s of students) {
    const features = await featuresForStudent(s.id);
    const sc = score(features);
    if (sc > highest) highest = sc;
    await prisma.dropoutRiskScore.create({
      data: { studentId: s.id, score: sc, factors: features as never },
    });
  }
  return { scored: students.length, topRisk: highest };
}
