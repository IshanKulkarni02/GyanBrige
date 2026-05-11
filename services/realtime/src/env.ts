import { z } from 'zod';

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
