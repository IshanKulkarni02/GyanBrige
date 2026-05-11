import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
});

export const env = schema.parse(process.env);
