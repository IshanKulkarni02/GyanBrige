import type { FastifyPluginAsync } from 'fastify';
import { prisma, mongo } from '../../db.js';

export const registerHealth: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok',
    time: new Date().toISOString(),
  }));

  app.get('/health/deep', async () => {
    const pg = await prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch(() => 'down');
    const mg = await mongo()
      .admin()
      .ping()
      .then(() => 'ok')
      .catch(() => 'down');
    return { postgres: pg, mongo: mg };
  });
};
