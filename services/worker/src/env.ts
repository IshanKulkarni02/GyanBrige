import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
];
for (const p of candidates) {
  if (fs.existsSync(p)) { loadDotenv({ path: p }); break; }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
});

export const env = schema.parse(process.env);
