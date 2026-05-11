// Chat REST surface. Realtime delivery lives in services/realtime (Socket.IO).
// REST is for: list rooms, list history, create DM/group/class/club rooms.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { ulid } from 'ulid';
import { prisma } from '../../db.js';
import { mongo } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const createSchema = z.object({
  kind: z.enum(['dm', 'group', 'class', 'club']),
  memberIds: z.array(z.string().uuid()).min(1),
  title: z.string().optional(),
  courseId: z.string().uuid().optional(),
  clubId: z.string().uuid().optional(),
});

export const registerChat: FastifyPluginAsync = async (app) => {
  app.get('/rooms', async (req) => {
    const me = await requireAuth(req);
    const db = mongo();
    return db
      .collection('chat_rooms')
      .find({ memberIds: me.id })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .toArray();
  });

  app.post('/rooms', async (req) => {
    const me = await requireAuth(req);
    const body = createSchema.parse(req.body);
    const memberIds = [...new Set([me.id, ...body.memberIds])];
    const db = mongo();

    if (body.kind === 'dm' && memberIds.length === 2) {
      const existing = await db
        .collection('chat_rooms')
        .findOne({ kind: 'dm', memberIds: { $all: memberIds, $size: 2 } });
      if (existing) return existing;
    }

    const doc = {
      _id: ulid(),
      kind: body.kind,
      memberIds,
      adminIds: [me.id],
      title: body.title ?? null,
      courseId: body.courseId ?? null,
      clubId: body.clubId ?? null,
      lastMessageAt: new Date(),
      createdAt: new Date(),
    };
    await db.collection('chat_rooms').insertOne(doc as never);
    return doc;
  });

  app.post('/rooms/class/:courseId', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { courseId } = req.params as { courseId: string };
    const enr = await prisma.enrollment.findMany({
      where: { courseId },
      select: { userId: true },
    });
    const teachers = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teachers: { select: { id: true } } },
    });
    const memberIds = [...new Set([me.id, ...enr.map((e) => e.userId), ...(teachers?.teachers.map((t) => t.id) ?? [])])];
    const db = mongo();
    const existing = await db.collection('chat_rooms').findOne({ kind: 'class', courseId });
    if (existing) {
      await db
        .collection('chat_rooms')
        .updateOne({ _id: existing._id }, { $set: { memberIds } });
      return existing;
    }
    const doc = {
      _id: ulid(),
      kind: 'class',
      memberIds,
      adminIds: teachers?.teachers.map((t) => t.id) ?? [me.id],
      title: null,
      courseId,
      clubId: null,
      lastMessageAt: new Date(),
      createdAt: new Date(),
    };
    await db.collection('chat_rooms').insertOne(doc as never);
    return doc;
  });

  app.get('/rooms/:id/messages', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const { before, limit = '50' } = req.query as { before?: string; limit?: string };
    const db = mongo();
    const room = await db.collection('chat_rooms').findOne({ _id: id as never });
    if (!room) throw new AppError(404, 'NOT_FOUND', 'Room not found');
    if (!(room.memberIds as string[]).includes(me.id))
      throw new AppError(403, 'FORBIDDEN', 'Not a member');
    const filter: Record<string, unknown> = { roomId: id };
    if (before) filter.createdAt = { $lt: new Date(before) };
    return db
      .collection('chat_messages')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 200))
      .toArray();
  });

  app.post('/rooms/:id/members', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const { userIds } = z.object({ userIds: z.array(z.string().uuid()).min(1) }).parse(req.body);
    const db = mongo();
    const room = await db.collection('chat_rooms').findOne({ _id: id as never });
    if (!room) throw new AppError(404, 'NOT_FOUND', 'Room not found');
    if (!(room.adminIds as string[]).includes(me.id))
      throw new AppError(403, 'FORBIDDEN', 'Only room admins can add members');
    const merged = [...new Set([...(room.memberIds as string[]), ...userIds])];
    await db.collection('chat_rooms').updateOne({ _id: id as never }, { $set: { memberIds: merged } });
    return { count: merged.length };
  });
};
