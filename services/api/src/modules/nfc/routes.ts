// NFC tag management + rotating-QR generator.
// Teacher / admin issue tags pinned to a classroom; rotating QR re-mints a
// signed payload every 30s so screenshots can't be replayed.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '../../db.js';
import { requireRole, requireAuth } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';
import { mintTagSecret, signNfcPayload, makeNonce } from '../../lib/nfc-payload.js';

const createSchema = z.object({ classroomId: z.string().uuid() });

export const registerNfc: FastifyPluginAsync = async (app) => {
  app.get('/tags', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    return prisma.nfcTag.findMany({
      include: { classroom: true, createdBy: { select: { id: true, name: true } } },
      orderBy: { rotatedAt: 'desc' },
    });
  });

  app.post('/tags', async (req) => {
    const me = await requireRole(req, Role.ADMIN, Role.STAFF);
    const body = createSchema.parse(req.body);
    const tag = await prisma.nfcTag.create({
      data: {
        classroomId: body.classroomId,
        publicId: crypto.randomBytes(8).toString('hex'),
        hmacSecret: mintTagSecret(),
        createdById: me.id,
      },
      include: { classroom: true },
    });
    const initialPayload = signNfcPayload(
      { tagId: tag.publicId, classroomId: tag.classroomId, nonce: makeNonce(), exp: 2_147_483_647 },
      tag.hmacSecret,
    );
    return { tag, payloadToWrite: initialPayload };
  });

  app.post('/tags/:id/rotate', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const tag = await prisma.nfcTag.update({
      where: { id },
      data: { hmacSecret: mintTagSecret(), rotatedAt: new Date() },
    });
    const payload = signNfcPayload(
      { tagId: tag.publicId, classroomId: tag.classroomId, nonce: makeNonce(), exp: 2_147_483_647 },
      tag.hmacSecret,
    );
    return { tag, payloadToWrite: payload };
  });

  app.delete('/tags/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    await prisma.nfcTag.delete({ where: { id } });
    return { ok: true };
  });

  // Rotating QR: 30-second windows. Server returns the current payload + the
  // next window start. Client polls (or websocket later) so the QR refreshes.
  app.get('/qr/:lectureId', async (req) => {
    const me = await requireAuth(req);
    const { lectureId } = req.params as { lectureId: string };
    const lec = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        course: {
          include: {
            teachers: { select: { id: true } },
            timetables: { include: { classroom: { include: { nfcTags: true } } } },
          },
        },
      },
    });
    if (!lec) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    const isTeacher = lec.course.teachers.some((t) => t.id === me.id);
    if (!isTeacher && !me.roles.includes(Role.ADMIN) && !me.roles.includes(Role.STAFF))
      throw new AppError(403, 'FORBIDDEN', 'Only teacher can render QR');

    const tag = lec.course.timetables[0]?.classroom.nfcTags[0];
    if (!tag) throw new AppError(409, 'NO_TAG', 'Classroom has no NFC tag — create one first');

    const WINDOW = 30;
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / WINDOW);
    const exp = (window + 1) * WINDOW;
    const payload = signNfcPayload(
      { tagId: tag.publicId, classroomId: tag.classroomId, nonce: makeNonce(), exp },
      tag.hmacSecret,
    );
    return { payload, tagId: tag.publicId, exp, refreshInSec: exp - now };
  });
};
