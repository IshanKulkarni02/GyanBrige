import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { NoticeScope, Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const createSchema = z.object({
  scope: z.nativeEnum(NoticeScope),
  targetId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  title: z.string().min(2),
  body: z.string().min(2),
  attachments: z.array(z.unknown()).default([]),
  pinned: z.boolean().default(false),
  expiresAt: z.coerce.date().optional(),
});

async function visibleToUser(userId: string, roles: Role[]) {
  if (roles.includes(Role.ADMIN) || roles.includes(Role.STAFF)) return {};
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true, course: { select: { subject: { select: { deptId: true } } } } },
  });
  const courseIds = enrollments.map((e) => e.courseId);
  const deptIds = [...new Set(enrollments.map((e) => e.course.subject.deptId))];
  const clubIds = (
    await prisma.clubMember.findMany({ where: { userId }, select: { clubId: true } })
  ).map((m) => m.clubId);
  return {
    OR: [
      { scope: NoticeScope.COLLEGE },
      { scope: NoticeScope.DEPARTMENT, targetId: { in: deptIds } },
      { scope: NoticeScope.COURSE, OR: [{ courseId: { in: courseIds } }, { targetId: { in: courseIds } }] },
      { scope: NoticeScope.CLUB, targetId: { in: clubIds } },
    ],
  };
}

export const registerNotices: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const me = await requireAuth(req);
    const where = await visibleToUser(me.id, me.roles);
    return prisma.notice.findMany({
      where: {
        AND: [where, { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] }],
      },
      include: { acks: { where: { userId: me.id }, select: { ackedAt: true } } },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
      take: 200,
    });
  });

  app.get('/:id', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const notice = await prisma.notice.findUnique({
      where: { id },
      include: { acks: { where: { userId: me.id }, select: { ackedAt: true } } },
    });
    if (!notice) throw new AppError(404, 'NOT_FOUND', 'Notice not found');
    return notice;
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF, Role.CLUB_LEAD);
    const body = createSchema.parse(req.body);
    return prisma.notice.create({ data: body });
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    await prisma.notice.delete({ where: { id } });
    return { ok: true };
  });

  app.post('/:id/ack', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    await prisma.noticeAck.upsert({
      where: { noticeId_userId: { noticeId: id, userId: me.id } },
      create: { noticeId: id, userId: me.id },
      update: {},
    });
    return { ok: true };
  });

  app.get('/:id/acks', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    return prisma.noticeAck.findMany({
      where: { noticeId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { ackedAt: 'desc' },
    });
  });
};
