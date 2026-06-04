/**
 * Two append-only log files written to <project-root>/logs/
 *   logs/activity.log  — every API request + response
 *   logs/error.log     — every error / exception
 *
 * Both files are plain text, one JSON line per entry for easy grep/parsing.
 */

import { appendFileSync, mkdirSync } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

const LOG_DIR = path.join(process.cwd(), 'logs');

// Create logs/ directory once on module load
try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}

// ── Internal write helper ────────────────────────────────────────────────────

function writeLine(file: string, data: Record<string, unknown>) {
  try {
    appendFileSync(
      path.join(LOG_DIR, file),
      JSON.stringify({ ts: new Date().toISOString(), ...data }) + '\n'
    );
  } catch {} // never let logging crash the app
}

// ── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  /** Log an error with optional context. */
  error(msg: string, ctx?: Record<string, unknown>) {
    writeLine('error.log', { level: 'ERROR', msg, ...ctx });
  },

  /** Log an activity event (request in/out, background job, etc.). */
  activity(msg: string, ctx?: Record<string, unknown>) {
    writeLine('activity.log', { level: 'INFO', msg, ...ctx });
  },
};

// ── Retry helper ────────────────────────────────────────────────────────────
/**
 * Retry an async function up to `attempts` times on transient network errors
 * (TypeError: fetch failed, ECONNRESET, ETIMEDOUT, etc.).
 * API-level errors (4xx/5xx) are NOT retried — only network-level throws.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 2000,
  label = 'operation'
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isNetwork = msg.includes('fetch failed') || msg.includes('ECONNRESET') ||
                        msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND') ||
                        msg.includes('network') || msg.includes('socket');
      if (!isNetwork) throw err; // API error — don't retry
      lastErr = err;
      logger.error(`${label} failed (attempt ${i + 1}/${attempts}), retrying in ${delayMs}ms`, { error: msg });
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ── Route wrapper ────────────────────────────────────────────────────────────
// Wraps any Next.js route handler to log:
//   → request  (method, path, user)
//   ← response (status, duration)
//   ✗ error    (message + first 4 stack frames) written to error.log

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: NextRequest, ctx?: any) => Promise<NextResponse>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logRoute(handler: Handler): Handler {
  return async (req: NextRequest, ctx?: any): Promise<NextResponse> => {
    const start  = Date.now();
    const uid    = req.headers.get('x-user-id')   ?? 'anon';
    const role   = req.headers.get('x-user-role')  ?? '-';
    const label  = `${req.method} ${req.nextUrl.pathname}`;

    logger.activity(`→ ${label}`, { uid, role });

    try {
      const res = await handler(req, ctx);
      logger.activity(`← ${label} ${res.status}`, { ms: Date.now() - start, uid });
      return res;
    } catch (err) {
      const stack = err instanceof Error
        ? err.stack?.split('\n').slice(0, 4).join(' | ')
        : undefined;
      logger.error(`✗ ${label}`, {
        ms: Date.now() - start, uid, role,
        error: err instanceof Error ? err.message : String(err),
        stack,
      });
      // Re-throw — Next.js will still return a 500
      throw err;
    }
  };
}
