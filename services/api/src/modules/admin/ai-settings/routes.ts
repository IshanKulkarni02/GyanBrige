// Admin AI settings proxy. The transcription service owns the live toggle
// (USE_LOCAL_AI), so we don't duplicate state — we forward to its endpoints.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { requireRole } from '../../../lib/role-guard.js';
import { env } from '../../../env.js';
import { AppError } from '../../../plugins/errors.js';

const updateSchema = z.object({
  useLocalAI: z.boolean().optional(),
  openaiModel: z.string().optional(),
  ollamaModel: z.string().optional(),
});

const testSchema = z.object({ backend: z.enum(['openai', 'ollama']).optional() });

async function proxy(path: string, init: RequestInit = {}) {
  const res = await fetch(`${env.TRANSCRIPTION_URL}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AppError(res.status, 'TRANSCRIPTION_ERROR', JSON.stringify(body));
  return body;
}

export const registerAiSettings: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    return proxy('/api/ai/config');
  });

  app.put('/', async (req) => {
    await requireRole(req, Role.ADMIN);
    const body = updateSchema.parse(req.body);
    return proxy('/api/ai/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  app.post('/toggle', async (req) => {
    await requireRole(req, Role.ADMIN);
    return proxy('/api/ai/toggle', { method: 'POST' });
  });

  app.post('/test', async (req) => {
    await requireRole(req, Role.ADMIN);
    const body = testSchema.parse(req.body);
    return proxy('/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
};
