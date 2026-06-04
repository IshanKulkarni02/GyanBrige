/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Patches console.error so every server-side error automatically lands
 * in logs/error.log without touching individual route files.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('@/lib/logger');

    const origError = console.error.bind(console);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error = (...args: any[]) => {
      origError(...args);
      logger.error(
        args
          .map(a => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a)))
          .join(' ')
      );
    };

    const origWarn = console.warn.bind(console);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.warn = (...args: any[]) => {
      origWarn(...args);
      logger.error('[WARN] ' + args.map(String).join(' '));
    };

    // Catch any unhandled promise rejections that slip past route handlers
    process.on('unhandledRejection', (reason) => {
      logger.error('unhandledRejection', {
        error: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    });

    logger.activity('server started', { node: process.version, env: process.env.NODE_ENV });
  }
}
