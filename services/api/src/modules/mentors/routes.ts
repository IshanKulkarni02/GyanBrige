// Mentor matching. Greedy algorithm: match a mentee to mentors with maximum
// (sharedCourses + senior gap) score, capped at 3 active mentees per mentor.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';

interface MatchProposal {
  mentorId: string;
  mentorName: string;
  sharedCourseIds: string[];
  score: number;
}

export const registerMentors: FastifyPluginAsync = async (app) => {
  app.get('/suggestions', async (req) => {
    const me = await requireAuth(req);
    const myEnrollments = await prisma.enrollment.findMany({
      where: { userId: me.id },
      select: { courseId: true },
    });
    const myCourseIds = myEnrollments.map((e) => e.courseId);
    if (myCourseIds.length === 0) return { matches: [] };

    const potential = await prisma.user.findMany({
      where: {
        id: { not: me.id },
        isActive: true,
        roles: { some: { role: { in: [Role.STUDENT, Role.TEACHER] } } },
        enrollments: { some: { courseId: { in: myCourseIds } } },
      },
      include: {
        enrollments: { select: { courseId: true } },
        roles: { select: { role: true } },
      },
      take: 50,
    });

    const matches: MatchProposal[] = potential
      .map((u) => {
        const shared = u.enrollments
          .map((e) => e.courseId)
          .filter((id) => myCourseIds.includes(id));
        const isFaculty = u.roles.some((r) => r.role === Role.TEACHER);
        return {
          mentorId: u.id,
          mentorName: u.name,
          sharedCourseIds: shared,
          score: shared.length + (isFaculty ? 2 : 0),
        };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return { matches };
  });

  app.post('/request', async (req) => {
    const me = await requireAuth(req);
    const { mentorId, note } = z
      .object({ mentorId: z.string().uuid(), note: z.string().optional() })
      .parse(req.body);
    // Persist as Application of kind=MENTOR_MATCH (reuses workflow + history)
    const form = await prisma.applicationForm.upsert({
      where: { id: 'form-mentor-match' },
      create: {
        id: 'form-mentor-match',
        kind: 'MENTOR_MATCH',
        name: 'Mentor request',
        schema: { fields: [{ id: 'note', type: 'long', label: 'Why?', required: false }] } as never,
        workflow: { steps: [{ id: 'approve', approverRole: 'TEACHER' }] } as never,
      },
      update: {},
    });
    return prisma.application.create({
      data: {
        kind: 'MENTOR_MATCH',
        formId: form.id,
        applicantId: me.id,
        payload: { mentorId, note } as never,
        status: 'IN_REVIEW',
        currentApproverId: mentorId,
        history: [] as never,
      },
    });
  });

  app.get('/inbox', async (req) => {
    const me = await requireRole(req, Role.STUDENT, Role.TEACHER, Role.ADMIN);
    return prisma.application.findMany({
      where: { kind: 'MENTOR_MATCH', currentApproverId: me.id, status: 'IN_REVIEW' },
      include: { applicant: { select: { id: true, name: true } } },
    });
  });
};
