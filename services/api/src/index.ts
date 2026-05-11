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
import { registerAttendance } from './modules/attendance/routes.js';
import { registerNfc } from './modules/nfc/routes.js';
import { registerCaps } from './modules/admin/caps/routes.js';
import { registerCampusNetworks } from './modules/admin/campus-networks/routes.js';
import { registerNotices } from './modules/notices/routes.js';
import { registerFeedback } from './modules/feedback/routes.js';
import { registerResults } from './modules/results/routes.js';
import { registerAssignments } from './modules/assignments/routes.js';
import { registerTests } from './modules/tests/routes.js';
import { registerChat } from './modules/chat/routes.js';
import { registerClubs } from './modules/clubs/routes.js';
import { registerApplications } from './modules/applications/routes.js';
import { registerAiTutor } from './modules/ai-tutor/routes.js';
import { registerDoubts } from './modules/doubts/routes.js';
import { registerFlashcards } from './modules/flashcards/routes.js';
import { registerSearch } from './modules/search/routes.js';
import { registerStudyPlan } from './modules/study-plan/routes.js';
import { registerAnalytics } from './modules/analytics/routes.js';
import { registerAccreditation } from './modules/accreditation/routes.js';
import { registerGoogleIntegration } from './modules/integrations/google/routes.js';
import { registerMentors } from './modules/mentors/routes.js';
import { registerGamification } from './modules/gamification/routes.js';
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
  await app.register(registerAttendance, { prefix: '/api/attendance' });
  await app.register(registerNfc, { prefix: '/api/nfc' });
  await app.register(registerCaps, { prefix: '/api/admin/caps' });
  await app.register(registerCampusNetworks, { prefix: '/api/admin/campus-networks' });
  await app.register(registerNotices, { prefix: '/api/notices' });
  await app.register(registerFeedback, { prefix: '/api/feedback' });
  await app.register(registerResults, { prefix: '/api/results' });
  await app.register(registerAssignments, { prefix: '/api/assignments' });
  await app.register(registerTests, { prefix: '/api/tests' });
  await app.register(registerChat, { prefix: '/api/chat' });
  await app.register(registerClubs, { prefix: '/api/clubs' });
  await app.register(registerApplications, { prefix: '/api/applications' });
  await app.register(registerAiTutor, { prefix: '/api/ai-tutor' });
  await app.register(registerDoubts, { prefix: '/api/doubts' });
  await app.register(registerFlashcards, { prefix: '/api/flashcards' });
  await app.register(registerSearch, { prefix: '/api/search' });
  await app.register(registerStudyPlan, { prefix: '/api/study-plan' });
  await app.register(registerAnalytics, { prefix: '/api/analytics' });
  await app.register(registerAccreditation, { prefix: '/api/accreditation' });
  await app.register(registerGoogleIntegration, { prefix: '/api/integrations/google' });
  await app.register(registerMentors, { prefix: '/api/mentors' });
  await app.register(registerGamification, { prefix: '/api/gamification' });

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
