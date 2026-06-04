// Google Calendar sync. Per-user OAuth tokens stored on User row (extended
// via JSON metadata on User). Push: upcoming lectures + assignments → user's
// primary calendar. Lightweight implementation: callable on demand.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../db.js';
import { env } from '../../../env.js';
import { requireAuth } from '../../../lib/role-guard.js';
import { AppError } from '../../../plugins/errors.js';

// In a single-tenant deploy we store tokens in AuditLog's payload as a
// stop-gap (no extra table yet). For prod a dedicated GoogleAuthToken model
// would be added; this lets the integration ship without a schema migration.
async function getToken(userId: string): Promise<string | null> {
  const row = await prisma.auditLog.findFirst({
    where: { actorId: userId, resource: 'google-auth-token' },
    orderBy: { at: 'desc' },
  });
  return (row?.payload as { access_token?: string } | null)?.access_token ?? null;
}

async function saveToken(userId: string, token: string): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: 'connect',
      resource: 'google-auth-token',
      payload: { access_token: token } as never,
    },
  });
}

export const registerGoogleIntegration: FastifyPluginAsync = async (app) => {
  app.post('/connect', async (req) => {
    const me = await requireAuth(req);
    const { access_token } = z.object({ access_token: z.string() }).parse(req.body);
    await saveToken(me.id, access_token);
    return { ok: true };
  });

  app.get('/status', async (req) => {
    const me = await requireAuth(req);
    const token = await getToken(me.id);
    return { connected: !!token, clientId: env.GOOGLE_CLIENT_ID ?? null };
  });

  app.post('/sync-calendar', async (req) => {
    const me = await requireAuth(req);
    const token = await getToken(me.id);
    if (!token) throw new AppError(409, 'NOT_CONNECTED', 'Google not connected');

    const upcoming = await prisma.lecture.findMany({
      where: {
        scheduledAt: { gte: new Date() },
        course: {
          OR: [
            { teachers: { some: { id: me.id } } },
            { enrollments: { some: { userId: me.id } } },
          ],
        },
      },
      include: { course: { include: { subject: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 30,
    });

    let pushed = 0;
    for (const lec of upcoming) {
      const start = lec.scheduledAt.toISOString();
      const end = new Date(lec.scheduledAt.getTime() + 60 * 60 * 1000).toISOString();
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: `${lec.course.subject.code} · ${lec.title}`,
            start: { dateTime: start },
            end: { dateTime: end },
            description: `GyanBrige lecture: ${lec.id}`,
          }),
        },
      );
      if (res.ok) pushed++;
    }
    return { pushed, total: upcoming.length };
  });
};
