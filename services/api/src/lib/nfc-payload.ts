// Signed NFC payload: HMAC-SHA256 over {tagId, classroomId, nonce, exp}.
// Each scan must produce a payload with the same tag-pinned HMAC secret so
// physical tag rotation (admin issues new tag → old becomes useless).
// QR codes encode the SAME payload format, rotating exp every 30s server-side.

import crypto from 'node:crypto';
import { env } from '../env.js';

export interface NfcPayload {
  tagId: string;
  classroomId: string;
  nonce: string;
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

function hmacFor(secret: string): crypto.Hmac {
  return crypto.createHmac('sha256', `${env.NFC_SIGNING_SECRET}:${secret}`);
}

export function signNfcPayload(payload: NfcPayload, tagSecret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64url(hmacFor(tagSecret).update(body).digest());
  return `${body}.${sig}`;
}

export interface VerifyResult {
  ok: boolean;
  payload?: NfcPayload;
  reason?: string;
}

export function verifyNfcPayload(token: string, tagSecret: string): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [body, sig] = parts as [string, string];

  const expected = hmacFor(tagSecret).update(body).digest();
  const got = fromB64url(sig);
  if (got.length !== expected.length) return { ok: false, reason: 'signature' };
  if (!crypto.timingSafeEqual(got, expected)) return { ok: false, reason: 'signature' };

  let payload: NfcPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8')) as NfcPayload;
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };
  return { ok: true, payload };
}

export function makeNonce(): string {
  return crypto.randomBytes(12).toString('base64url');
}

export function mintTagSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}
