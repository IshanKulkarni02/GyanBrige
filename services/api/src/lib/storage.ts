import { Client } from 'minio';
import { env } from '../env.js';

const url = new URL(env.MINIO_ENDPOINT);

export const minio = new Client({
  endPoint: url.hostname,
  port: url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80),
  useSSL: url.protocol === 'https:',
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export const BUCKET = env.MINIO_BUCKET;

export async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET);
  if (!exists) await minio.makeBucket(BUCKET);
}

export function publicUrl(objectName: string): string {
  return `${env.MINIO_ENDPOINT}/${BUCKET}/${objectName}`;
}
