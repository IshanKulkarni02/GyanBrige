import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const listQuery = z.object({
  q: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const updateRolesSchema = z.object({
  roles: z.array(z.object({ role: z.nativeEnum(Role), scopeId: z.string().optional() })),
});

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  role: z.nativeEnum(Role).default(Role.STUDENT),
  scopeId: z.string().uuid().optional(),
});

export const registerUsers: FastifyPluginAsync = async (app) => {
  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const body = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered');
    const hashedPassword = await argon2.hash(body.password);
    return prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        hashedPassword,
        roles: { create: { role: body.role, scopeId: body.scopeId ?? null } },
      },
      select: { id: true, email: true, name: true, roles: { select: { role: true } } },
    });
  });

  app.get('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF, Role.TEACHER);
    const q = listQuery.parse(req.query);
    const where = {
      AND: [
        q.q
          ? {
              OR: [
                { name: { contains: q.q, mode: 'insensitive' as const } },
                { email: { contains: q.q, mode: 'insensitive' as const } },
              ],
            }
          : {},
        q.role ? { roles: { some: { role: q.role } } } : {},
      ],
    };
    const users = await prisma.user.findMany({
      where,
      take: q.limit + 1,
      cursor: q.cursor ? { id: q.cursor } : undefined,
      skip: q.cursor ? 1 : 0,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        roles: { select: { role: true, scopeId: true } },
      },
    });
    const nextCursor = users.length > q.limit ? users.pop()!.id : null;
    return { users, nextCursor };
  });

  app.get('/:id', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const isSelf = id === me.id;
    const isAdmin = me.roles.includes(Role.ADMIN) || me.roles.includes(Role.STAFF);
    if (!isSelf && !isAdmin) throw new AppError(403, 'FORBIDDEN', 'Cannot view other users');
    return prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        roles: { select: { role: true, scopeId: true } },
        enrollments: { select: { course: { include: { subject: true } } } },
      },
    });
  });

  app.put('/:id/roles', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    const body = updateRolesSchema.parse(req.body);
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: id } }),
      prisma.userRole.createMany({
        data: body.roles.map((r) => ({ userId: id, role: r.role, scopeId: r.scopeId ?? null })),
      }),
    ]);
    return prisma.user.findUniqueOrThrow({
      where: { id },
      include: { roles: true },
    });
  });

  app.put('/:id/active', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    return prisma.user.update({ where: { id }, data: { isActive } });
  });
};
