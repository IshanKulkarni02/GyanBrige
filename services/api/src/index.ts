import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { env } from './env.js';
import { logger } from './logger.js';
import { connectMongo, disconnectAll } from './db.js';
import { registerAuth } from './modules/auth/routes.js';
import { registerHealth } from './modules/health/routes.js';
import { registerUsers } from './modules/users/routes.js';
import { registerDepartments } from './modules/departments/routes.js';
import { registerSubjects } from './modules/subjects/routes.js';
import { registerCourses } from './modules/courses/routes.js';
import { registerClassrooms } from './modules/classrooms/routes.js';
import { registerTimetable } from './modules/timetable/routes.js';
import { registerAudit } from './modules/audit/routes.js';
import { registerInvites } from './modules/invites/routes.js';
import { registerSisImport } from './modules/admin/sis-import/routes.js';
import { registerLectures } from './modules/lectures/routes.js';
import { registerLivestreams } from './modules/livestreams/routes.js';
import { registerNotes } from './modules/notes/routes.js';
import { registerAiSettings } from './modules/admin/ai-settings/routes.js';
import { auditPlugin } from './plugins/audit.js';
import { errorPlugin } from './plugins/errors.js';

async function main() {
  await connectMongo();

  const app = Fastify({ loggerInstance: logger, trustProxy: true });

  await app.register(cors, {
    origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: 'gb_token', signed: false },
  });
  await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } });
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });

  await app.register(errorPlugin);
  await app.register(auditPlugin);

  await app.register(registerHealth, { prefix: '/api' });
  await app.register(registerAuth, { prefix: '/api/auth' });
  await app.register(registerUsers, { prefix: '/api/users' });
  await app.register(registerDepartments, { prefix: '/api/departments' });
  await app.register(registerSubjects, { prefix: '/api/subjects' });
  await app.register(registerCourses, { prefix: '/api/courses' });
  await app.register(registerClassrooms, { prefix: '/api/classrooms' });
  await app.register(registerTimetable, { prefix: '/api/timetable' });
  await app.register(registerInvites, { prefix: '/api/invites' });
  await app.register(registerAudit, { prefix: '/api/audit' });
  await app.register(registerSisImport, { prefix: '/api/admin/sis-import' });
  await app.register(registerLectures, { prefix: '/api/lectures' });
  await app.register(registerLivestreams, { prefix: '/api/livestreams' });
  await app.register(registerNotes, { prefix: '/api/notes' });
  await app.register(registerAiSettings, { prefix: '/api/admin/ai-settings' });

  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info(`api listening on http://${env.HOST}:${env.PORT}`);
}

const shutdown = async () => {
  logger.info('shutting down');
  await disconnectAll();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  logger.error(err, 'fatal boot error');
  process.exit(1);
});
