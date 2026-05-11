import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  MONGO_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  NFC_SIGNING_SECRET: z.string().min(16),
  INVITE_SIGNING_SECRET: z.string().min(16),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  LIVEKIT_API_KEY: z.string(),
  LIVEKIT_API_SECRET: z.string().min(16),
  LIVEKIT_URL: z.string(),
  LIVEKIT_EGRESS_WEBHOOK_URL: z.string().url().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),

  MINIO_ENDPOINT: z.string().url(),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET: z.string().default('gyanbrige'),

  TRANSCRIPTION_URL: z.string().url(),
  REALTIME_URL: z.string(),

  CAMPUS_CIDR: z.string().default('10.0.0.0/16'),
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:1420'),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
