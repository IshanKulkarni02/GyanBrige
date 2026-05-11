import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../../db.js';
import { requireRole } from '../../../lib/role-guard.js';

const schema = z.object({
  cidr: z.string().regex(/^\d+\.\d+\.\d+\.\d+\/\d+$/),
  ssid: z.string().optional(),
  bssid: z.string().optional(),
  label: z.string().optional(),
});

export const registerCampusNetworks: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    return prisma.campusNetwork.findMany({ orderBy: { cidr: 'asc' } });
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN);
    return prisma.campusNetwork.create({ data: schema.parse(req.body) });
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    await prisma.campusNetwork.delete({ where: { id } });
    return { ok: true };
  });
};
