import { Queue, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './env.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const connection: ConnectionOptions = { connection: redis };

export const queues = {
  bulkImport: new Queue('bulk-import', connection),
  embedTranscript: new Queue('embed-transcript', connection),
  plagiarismText: new Queue('plagiarism-text', connection),
  plagiarismCode: new Queue('plagiarism-code', connection),
  generateStudyPlan: new Queue('generate-study-plan', connection),
  autogradeEssay: new Queue('autograde-essay', connection),
  dropoutRisk: new Queue('dropout-risk', connection),
  flashcardGen: new Queue('flashcard-gen', connection),
  chapterDetect: new Queue('chapter-detect', connection),
  captionsTranslate: new Queue('captions-translate', connection),
};
