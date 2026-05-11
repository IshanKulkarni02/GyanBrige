import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const errorPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply
        .code(err.statusCode)
        .send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err instanceof ZodError) {
      return reply
        .code(400)
        .send({ error: { code: 'VALIDATION', message: 'Invalid input', details: err.flatten() } });
    }
    app.log.error(err);
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Internal error' } });
  });
};
