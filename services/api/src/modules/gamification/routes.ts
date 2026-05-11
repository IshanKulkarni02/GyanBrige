// Streaks, badges, leaderboard. Opt-in per course (teacher toggle stored in
// Course.room as JSON or a future Course.settings field — for now we just
// expose the data; per-course gating reads Notice.scope=COURSE pinned flag).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { requireAuth } from '../../lib/role-guard.js';

const BADGE_RULES: { code: string; label: string; check: (s: Stats) => boolean }[] = [
  { code: 'first_attendance', label: 'First Attendance', check: (s) => s.attendance >= 1 },
  { code: 'attendance_10', label: '10 Days Attended', check: (s) => s.attendance >= 10 },
  { code: 'streak_7', label: '7-day Streak', check: (s) => s.loginStreak >= 7 },
  { code: 'streak_30', label: 'Habit Builder (30d)', check: (s) => s.loginStreak >= 30 },
  { code: 'assignment_5', label: '5 Assignments On Time', check: (s) => s.assignmentsOnTime >= 5 },
  { code: 'perfect_quiz', label: 'Perfect Quiz', check: (s) => s.perfectQuizzes >= 1 },
];

interface Stats {
  attendance: number;
  loginStreak: number;
  assignmentsOnTime: number;
  perfectQuizzes: number;
  totalPoints: number;
}

async function computeStats(userId: string): Promise<Stats> {
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000);
  const [attendance, subs, attempts, engagements] = await Promise.all([
    prisma.attendance.count({ where: { studentId: userId } }),
    prisma.submission.count({
      where: { studentId: userId, status: 'GRADED', submittedAt: { gte: since } },
    }),
    prisma.testAttempt.findMany({
      where: { studentId: userId, score: { gte: 1 } },
      select: { score: true, test: { select: { questions: { select: { points: true } } } } },
    }),
    prisma.engagementEvent.findMany({
      where: { userId, kind: 'LOGIN', at: { gte: since } },
      select: { at: true },
      orderBy: { at: 'desc' },
    }),
  ]);

  let streak = 0;
  const seen = new Set<string>();
  for (const e of engagements) {
    const day = e.at.toISOString().slice(0, 10);
    seen.add(day);
  }
  let cursor = new Date();
  while (true) {
    const day = cursor.toISOString().slice(0, 10);
    if (seen.has(day)) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 24 * 3600 * 1000);
    } else break;
  }

  const perfectQuizzes = attempts.filter((a) => {
    const max = a.test.questions.reduce((s, q) => s + q.points, 0) || 1;
    return (a.score ?? 0) / max >= 0.99;
  }).length;

  const totalPoints =
    attendance * 5 + subs * 20 + perfectQuizzes * 50 + Math.min(streak, 30) * 3;
  return { attendance, loginStreak: streak, assignmentsOnTime: subs, perfectQuizzes, totalPoints };
}

export const registerGamification: FastifyPluginAsync = async (app) => {
  app.get('/me', async (req) => {
    const me = await requireAuth(req);
    const stats = await computeStats(me.id);
    const badges = BADGE_RULES.filter((b) => b.check(stats)).map((b) => ({
      code: b.code,
      label: b.label,
    }));
    return { stats, badges };
  });

  app.get('/leaderboard', async (req) => {
    await requireAuth(req);
    const { courseId } = z.object({ courseId: z.string().uuid().optional() }).parse(req.query);
    const where = courseId
      ? { enrollments: { some: { courseId } }, isActive: true }
      : { isActive: true };
    const users = await prisma.user.findMany({
      where: { ...where, roles: { some: { role: 'STUDENT' } } },
      select: { id: true, name: true },
      take: 200,
    });
    const scored = await Promise.all(
      users.map(async (u) => ({ ...u, stats: await computeStats(u.id) })),
    );
    return scored.sort((a, b) => b.stats.totalPoints - a.stats.totalPoints).slice(0, 50);
  });

  app.post('/login-event', async (req) => {
    const me = await requireAuth(req);
    return prisma.engagementEvent.create({
      data: { userId: me.id, kind: 'LOGIN' },
    });
  });
};
