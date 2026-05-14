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
  PORT: z.coerce.number().default(4002),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().url(),
  MONGO_URL: z.string().url(),
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:1420'),
});

export const env = schema.parse(process.env);
