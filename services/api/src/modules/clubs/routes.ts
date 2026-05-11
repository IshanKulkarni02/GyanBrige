import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role, RsvpStatus } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const createClubSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  leadIds: z.array(z.string().uuid()).default([]),
});

const eventSchema = z.object({
  clubId: z.string().uuid(),
  title: z.string().min(2),
  body: z.string().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  venue: z.string().optional(),
  rsvpRequired: z.boolean().default(false),
  capacity: z.number().int().min(1).optional(),
});

export const registerClubs: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const me = await requireAuth(req);
    return prisma.club.findMany({
      include: {
        leads: { select: { id: true, name: true } },
        _count: { select: { members: true, events: true } },
        members: { where: { userId: me.id }, select: { id: true } },
      },
    });
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const body = createClubSchema.parse(req.body);
    return prisma.club.create({
      data: {
        name: body.name,
        description: body.description,
        coverImage: body.coverImage,
        leads: { connect: body.leadIds.map((id) => ({ id })) },
      },
    });
  });

  app.post('/:id/join', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    return prisma.clubMember.upsert({
      where: { clubId_userId: { clubId: id, userId: me.id } },
      create: { clubId: id, userId: me.id },
      update: {},
    });
  });

  app.delete('/:id/leave', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    await prisma.clubMember.delete({
      where: { clubId_userId: { clubId: id, userId: me.id } },
    });
    return { ok: true };
  });

  app.post('/events', async (req) => {
    const me = await requireAuth(req);
    const body = eventSchema.parse(req.body);
    const club = await prisma.club.findUnique({
      where: { id: body.clubId },
      include: { leads: { select: { id: true } } },
    });
    if (!club) throw new AppError(404, 'NOT_FOUND', 'Club not found');
    if (!club.leads.some((l) => l.id === me.id) && !me.roles.includes(Role.ADMIN))
      throw new AppError(403, 'FORBIDDEN', 'Only club leads create events');
    return prisma.clubEvent.create({ data: body });
  });

  app.get('/events', async (req) => {
    await requireAuth(req);
    return prisma.clubEvent.findMany({
      where: { endAt: { gte: new Date() } },
      include: {
        club: { select: { id: true, name: true } },
        _count: { select: { rsvps: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  });

  app.post('/events/:id/rsvp', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const { status } = z.object({ status: z.nativeEnum(RsvpStatus) }).parse(req.body);
    return prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId: id, userId: me.id } },
      create: { eventId: id, userId: me.id, status },
      update: { status },
    });
  });

  app.post('/events/:id/check-in', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const { method } = z
      .object({ method: z.enum(['NFC', 'QR', 'MANUAL']) })
      .parse(req.body);
    return prisma.eventRsvp.update({
      where: { eventId_userId: { eventId: id, userId: me.id } },
      data: { checkedInAt: new Date(), checkInMethod: method },
    });
  });
};
