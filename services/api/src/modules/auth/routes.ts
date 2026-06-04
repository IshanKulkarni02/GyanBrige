import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { AppError } from '../../plugins/errors.js';
import { verifyInvite, signInvite } from '../../lib/invite.js';
import { requireRole } from '../../lib/role-guard.js';
import type { JwtPayload } from '../../lib/jwt.js';

const googleClient = env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID)
  : null;

const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  inviteToken: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleSchema = z.object({
  idToken: z.string(),
  inviteToken: z.string().optional(),
});

const inviteCreateSchema = z.object({
  role: z.nativeEnum(Role),
  deptId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  maxUses: z.number().int().min(1).max(10000).default(1),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});

function tokenFor(app: import('fastify').FastifyInstance, u: { id: string; email: string | null; roles: { role: Role }[] }): string {
  const payload: JwtPayload = { id: u.id, email: u.email, roles: u.roles.map((r) => r.role) };
  return app.jwt.sign(payload, { expiresIn: '30d' });
}

async function applyInvite(userId: string, inviteToken: string): Promise<void> {
  const payload = verifyInvite(inviteToken);
  if (!payload) throw new AppError(400, 'INVITE_INVALID', 'Invite token invalid');
  const inviteId = payload.id as string | undefined;
  if (!inviteId) throw new AppError(400, 'INVITE_INVALID', 'Invite payload malformed');

  const invite = await prisma.inviteLink.findUnique({ where: { id: inviteId } });
  if (!invite) throw new AppError(404, 'INVITE_NOT_FOUND', 'Invite not found');
  if (invite.expiresAt < new Date()) throw new AppError(410, 'INVITE_EXPIRED', 'Invite expired');
  if (invite.usedCount >= invite.maxUses)
    throw new AppError(429, 'INVITE_EXHAUSTED', 'Invite already used');

  await prisma.$transaction([
    prisma.userRole.create({
      data: { userId, role: invite.role, scopeId: invite.deptId ?? invite.courseId ?? null },
    }),
    invite.courseId
      ? prisma.enrollment.upsert({
          where: { userId_courseId: { userId, courseId: invite.courseId } },
          create: { userId, courseId: invite.courseId },
          update: {},
        })
      : prisma.inviteLink.update({ where: { id: invite.id }, data: {} }),
    prisma.inviteLink.update({
      where: { id: invite.id },
      data: { usedCount: { increment: 1 } },
    }),
  ]);
}

export const registerAuth: FastifyPluginAsync = async (app) => {
  app.post('/signup', async (req, reply) => {
    const body = signupSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered');

    const hashedPassword = await argon2.hash(body.password);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        hashedPassword,
        roles: body.inviteToken ? undefined : { create: { role: Role.STUDENT } },
      },
      include: { roles: true },
    });
    if (body.inviteToken) await applyInvite(user.id, body.inviteToken);

    const fresh = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { roles: true },
    });
    const token = tokenFor(app, fresh);
    reply.setCookie('gb_token', token, { httpOnly: true, sameSite: 'lax', path: '/' });
    return { token, user: { id: fresh.id, email: fresh.email, name: fresh.name } };
  });

  app.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { roles: true },
    });
    if (!user || !user.hashedPassword)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    const ok = await argon2.verify(user.hashedPassword, body.password);
    if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = tokenFor(app, user);
    reply.setCookie('gb_token', token, { httpOnly: true, sameSite: 'lax', path: '/' });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  });

  app.post('/google', async (req, reply) => {
    if (!googleClient) throw new AppError(501, 'GOOGLE_DISABLED', 'Google OAuth not configured');
    const body = googleSchema.parse(req.body);
    const ticket = await googleClient.verifyIdToken({
      idToken: body.idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Bad Google token');

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: p.sub }, { email: p.email }] },
      include: { roles: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: p.email,
          name: p.name ?? p.email.split('@')[0]!,
          avatar: p.picture,
          googleId: p.sub,
          roles: body.inviteToken ? undefined : { create: { role: Role.STUDENT } },
        },
        include: { roles: true },
      });
      if (body.inviteToken) await applyInvite(user.id, body.inviteToken);
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: p.sub, avatar: p.picture ?? user.avatar },
        include: { roles: true },
      });
    }

    const fresh = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { roles: true },
    });
    const token = tokenFor(app, fresh);
    reply.setCookie('gb_token', token, { httpOnly: true, sameSite: 'lax', path: '/' });
    return { token, user: { id: fresh.id, email: fresh.email, name: fresh.name } };
  });

  app.post('/logout', async (_req, reply) => {
    reply.clearCookie('gb_token', { path: '/' });
    return { ok: true };
  });

  app.get('/me', async (req) => {
    await req.jwtVerify();
    const { id } = req.user as JwtPayload;
    return prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        roles: { select: { role: true, scopeId: true } },
      },
    });
  });

  app.post('/invites', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const body = inviteCreateSchema.parse(req.body);
    const creator = (req.user as JwtPayload).id;

    const invite = await prisma.inviteLink.create({
      data: {
        token: 'placeholder',
        role: body.role,
        deptId: body.deptId,
        courseId: body.courseId,
        maxUses: body.maxUses,
        expiresAt: new Date(Date.now() + body.expiresInDays * 24 * 3600 * 1000),
        createdById: creator,
      },
    });
    const token = signInvite({ id: invite.id });
    await prisma.inviteLink.update({ where: { id: invite.id }, data: { token } });
    return { id: invite.id, token, expiresAt: invite.expiresAt };
  });

  app.get('/invites/:token', async (req) => {
    const { token } = req.params as { token: string };
    const payload = verifyInvite(token);
    if (!payload?.id) throw new AppError(400, 'INVITE_INVALID', 'Invite invalid');
    const invite = await prisma.inviteLink.findUnique({
      where: { id: payload.id as string },
      include: { department: true, course: { include: { subject: true } } },
    });
    if (!invite) throw new AppError(404, 'INVITE_NOT_FOUND', 'Invite not found');
    return {
      role: invite.role,
      deptName: invite.department?.name,
      courseName: invite.course?.subject.name,
      remaining: invite.maxUses - invite.usedCount,
      expiresAt: invite.expiresAt,
    };
  });
};
