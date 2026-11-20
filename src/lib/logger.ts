/**
 * Development Logger
 * Provides environment-aware logging with automated timestamps and API tracing.
 * Logs are stripped in production builds for performance and security.
 */

const isDev = import.meta.env.DEV;

const getTime = () => {
  const now = new Date();
  return (
    now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) +
    '.' +
    now.getMilliseconds().toString().padStart(3, '0')
  );
};

export const logger = {
  /**
   * General info log (dev only)
   */
  info: (...args: unknown[]) => {
    if (isDev) console.log(`[${getTime()}]`, ...args);
  },

  /**
   * Warning log (dev only)
   */
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(`[${getTime()}]`, ...args);
  },

  /**
   * Error log (always logged, even in prod)
   */
  error: (...args: unknown[]) => {
    console.error(`[${getTime()}]`, ...args);
  },

  /**
   * API trace with timing (dev only)
   */
  api: {
    start: (id: string, name: string) => {
      if (isDev) console.log(`[${getTime()}] ➡️ [API ${id}] START ${name}`);
    },
    done: (id: string, name: string, durationMs: number) => {
      if (isDev) {
        const icon = durationMs >= 1000 ? '🐢' : durationMs >= 500 ? '⚠️' : '✅';
        console.log(`[${getTime()}] ${icon} [API ${id}] DONE ${name} (${durationMs}ms)`);
      }
    },
    fail: (id: string, name: string, durationMs: number, error: unknown) => {
      // Errors are always logged
      console.error(`[${getTime()}] ❌ [API ${id}] FAIL ${name} (${durationMs}ms)`, error);
    },
  },

  /**
   * Security-sensitive log (dev only, never in prod)
   */
  secure: (message: string) => {
    if (isDev) console.log(`[${getTime()}] 🔐 ${message}`);
  },
};
