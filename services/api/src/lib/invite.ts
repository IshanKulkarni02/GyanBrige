import crypto from 'node:crypto';
import { env } from '../env.js';

export function signInvite(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', env.INVITE_SIGNING_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyInvite(token: string): Record<string, unknown> | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto
    .createHmac('sha256', env.INVITE_SIGNING_SECRET)
    .update(body)
    .digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
