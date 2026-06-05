// Google Calendar sync. Per-user OAuth tokens stored via AuditLog as a
// stop-gap (no extra table yet). For prod a dedicated GoogleAuthToken model
// would be added; this lets the integration ship without a schema migration.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../db.js';
import { env } from '../../../env.js';
import { requireAuth } from '../../../lib/role-guard.js';
import { AppError } from '../../../plugins/errors.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'].join(' ');

function callbackUrl(): string {
  const base = env.API_URL ?? `http://localhost:${env.PORT}`;
  return `${base}/api/integrations/google/callback`;
}

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
  // Returns the Google OAuth authorization URL. The state param encodes the
  // user's JWT so the callback can identify them without a session store.
  app.get('/auth-url', async (req) => {
    const me = await requireAuth(req);
    if (!env.GOOGLE_CLIENT_ID) throw new AppError(409, 'NOT_CONFIGURED', 'Google client not configured');

    // Encode userId in state so the callback can look up the user
    const state = jwt.sign({ userId: me.id }, env.JWT_SECRET, { expiresIn: '10m' });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', callbackUrl());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('state', state);
    return { url: url.toString() };
  });

  // OAuth callback: exchange code → access_token, store it, close the popup
  app.get('/callback', async (req, reply) => {
    const { code, state, error } = z
      .object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() })
      .parse(req.query);

    if (error || !code || !state) {
      return reply.type('text/html').send(closePopupHtml('Google sign-in was cancelled.', false));
    }

    let userId: string;
    try {
      const payload = jwt.verify(state, env.JWT_SECRET) as { userId: string };
      userId = payload.userId;
    } catch {
      return reply.type('text/html').send(closePopupHtml('Invalid or expired state.', false));
    }

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return reply.type('text/html').send(closePopupHtml('Google credentials not configured on server.', false));
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl(),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!tokenRes.ok) {
      return reply.type('text/html').send(closePopupHtml('Token exchange failed.', false));
    }

    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) {
      return reply.type('text/html').send(closePopupHtml('No access token returned.', false));
    }

    await saveToken(userId, access_token);
    return reply.type('text/html').send(closePopupHtml('Google Calendar connected!', true));
  });

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

function closePopupHtml(message: string, success: boolean): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:${success ? '#f0fdf4' : '#fef2f2'}">
<div style="text-align:center">
  <p style="font-size:1.2rem;color:${success ? '#16a34a' : '#dc2626'}">${message}</p>
  <p style="color:#6b7280;font-size:0.9rem">You can close this window.</p>
</div>
<script>
  window.opener?.postMessage({ type: 'google-oauth', success: ${success} }, '*');
  setTimeout(() => window.close(), 1500);
</script>
</body></html>`;
}
