// Faculty + admin analytics. Read-only API on top of EngagementEvent +
// DropoutRiskScore + roll-up queries.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma, mongo } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';

export const registerAnalytics: FastifyPluginAsync = async (app) => {
  app.post('/event', async (req) => {
    const me = await requireAuth(req);
    const body = z
      .object({
        kind: z.string(),
        contextId: z.string().optional(),
        payload: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(req.body);
    return prisma.engagementEvent.create({
      data: {
        userId: me.id,
        kind: body.kind,
        contextId: body.contextId ?? null,
        payload: (body.payload ?? {}) as never,
      },
    });
  });

  app.get('/dropout-risk', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const latest = await prisma.$queryRawUnsafe<
      { studentId: string; score: number; factors: unknown; computedAt: Date }[]
    >(
      `SELECT DISTINCT ON ("studentId") "studentId", score, factors, "computedAt"
         FROM "DropoutRiskScore"
        ORDER BY "studentId", "computedAt" DESC`,
    );
    const ids = latest.map((r) => r.studentId);
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return latest
      .map((r) => ({ ...r, user: byId.get(r.studentId) }))
      .sort((a, b) => b.score - a.score);
  });

  app.get('/lecture/:id/engagement-heatmap', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const reactions = (await mongo()
      .collection('live_polls')
      .aggregate([{ $match: { lectureId: id } }])
      .toArray()) as { openedAt: Date; votes: { at: Date }[] }[];

    const lostBuckets = new Map<number, number>();
    for (const r of reactions) {
      for (const v of r.votes ?? []) {
        const minute = Math.floor((v.at.getTime() - r.openedAt.getTime()) / 60_000);
        lostBuckets.set(minute, (lostBuckets.get(minute) ?? 0) + 1);
      }
    }
    return Array.from(lostBuckets.entries()).map(([minute, count]) => ({ minute, count }));
  });

  app.get('/course/:courseId/summary', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { courseId } = req.params as { courseId: string };
    const [enrolled, lectures, attendance, assignmentsDone] = await Promise.all([
      prisma.enrollment.count({ where: { courseId } }),
      prisma.lecture.count({ where: { courseId } }),
      prisma.attendance.count({ where: { lecture: { courseId } } }),
      prisma.submission.count({
        where: { assignment: { courseId }, status: { in: ['SUBMITTED', 'GRADED', 'LATE'] } },
      }),
    ]);
    return {
      enrolled,
      lectures,
      attendanceCount: attendance,
      attendanceRatio: lectures && enrolled ? attendance / (lectures * enrolled) : 0,
      assignmentsDone,
    };
  });
};
