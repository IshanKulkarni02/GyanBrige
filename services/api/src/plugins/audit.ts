import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../db.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const audit: FastifyPluginAsync = async (app) => {
  app.addHook('onResponse', async (req, reply) => {
    if (!MUTATING.has(req.method)) return;
    if (req.url.startsWith('/api/health')) return;
    if (reply.statusCode >= 500) return;

    const actorId = (req as { user?: { id?: string } }).user?.id ?? null;
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action: `${req.method} ${req.routeOptions.url ?? req.url}`,
          resource: req.routeOptions.url ?? req.url,
          resourceId: ((req.params as Record<string, string> | undefined)?.id) ?? null,
          payload: {
            status: reply.statusCode,
            body: sanitizeBody(req.body),
          },
          ip: req.ip,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });
    } catch (err) {
      app.log.warn({ err }, 'audit write failed');
    }
  });
};

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const cloned = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
  for (const key of Object.keys(cloned)) {
    if (/password|secret|token/i.test(key)) cloned[key] = '[REDACTED]';
  }
  return cloned;
}

export const auditPlugin = fp(audit, { name: 'audit' });
