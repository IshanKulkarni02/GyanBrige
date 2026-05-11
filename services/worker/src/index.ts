import { Worker } from 'bullmq';
import pino from 'pino';
import { connection } from './queues.js';
import { runBulkImport } from './jobs/bulk-import-sis.js';

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

// Placeholder workers (filled in in later phases) — register them so the
// orchestrator boots cleanly and queues exist on first deploy.
for (const name of [
  'embed-transcript',
  'plagiarism-text',
  'plagiarism-code',
  'generate-study-plan',
  'autograde-essay',
  'dropout-risk',
  'flashcard-gen',
  'chapter-detect',
  'captions-translate',
]) {
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
