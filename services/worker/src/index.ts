import { Worker } from 'bullmq';
import pino from 'pino';
import { connection } from './queues.js';
import { runBulkImport } from './jobs/bulk-import-sis.js';
import { runTextPlagiarism } from './jobs/plagiarism-text.js';
import { runCodePlagiarism } from './jobs/plagiarism-code.js';
import { runEmbedTranscript } from './jobs/embed-transcript.js';
import { runFlashcardGen } from './jobs/flashcard-gen.js';
import { runGenerateStudyPlan } from './jobs/generate-study-plan.js';
import { runAutogradeEssay } from './jobs/autograde-essay.js';

const log = pino({
  transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});

const workers: Worker[] = [];

workers.push(
  new Worker(
    'bulk-import',
    async (job) => {
      const { csv } = job.data as { csv: string };
      log.info({ jobId: job.id }, 'bulk import started');
      const result = await runBulkImport(csv);
      log.info({ jobId: job.id, ...result }, 'bulk import done');
      return result;
    },
    connection,
  ),
);

workers.push(
  new Worker(
    'plagiarism-text',
    async (job) => {
      const { submissionId } = job.data as { submissionId: string };
      log.info({ jobId: job.id, submissionId }, 'text plag started');
      return runTextPlagiarism(submissionId);
    },
    connection,
  ),
);

workers.push(
  new Worker(
    'plagiarism-code',
    async (job) => {
      const { submissionId, gitUrl } = job.data as { submissionId: string; gitUrl: string };
      log.info({ jobId: job.id, submissionId, gitUrl }, 'code plag started');
      return runCodePlagiarism(submissionId, gitUrl);
    },
    connection,
  ),
);

workers.push(
  new Worker(
    'embed-transcript',
    async (job) => {
      const { lectureId } = job.data as { lectureId: string };
      log.info({ jobId: job.id, lectureId }, 'embed started');
      return runEmbedTranscript(lectureId);
    },
    connection,
  ),
);

workers.push(
  new Worker(
    'flashcard-gen',
    async (job) => {
      const { lectureId } = job.data as { lectureId: string };
      return runFlashcardGen(lectureId);
    },
    connection,
  ),
);

workers.push(
  new Worker(
    'generate-study-plan',
    async (job) => {
      const { studentId, courseId } = job.data as { studentId: string; courseId: string };
      return runGenerateStudyPlan(studentId, courseId);
    },
    connection,
  ),
);

workers.push(
  new Worker(
    'autograde-essay',
    async (job) => {
      const { submissionId } = job.data as { submissionId: string };
      return runAutogradeEssay(submissionId);
    },
    connection,
  ),
);

// Placeholder workers (filled in in Phase 8).
for (const name of ['dropout-risk', 'chapter-detect', 'captions-translate']) {
  workers.push(
    new Worker(
      name,
      async (job) => {
        log.warn({ jobId: job.id, name }, 'noop worker — phase not yet implemented');
        return { noop: true };
      },
      connection,
    ),
  );
}

const shutdown = async () => {
  log.info('worker shutting down');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

log.info(`worker booted; queues: ${workers.map((w) => w.name).join(', ')}`);
