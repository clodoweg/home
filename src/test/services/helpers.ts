/** Service test helpers — fresh API client modules, console silencing and request inspection. */
import { vi } from 'vitest';

/** Client and domain modules loaded together, so they share the same `client.ts` state. */
export interface FreshServices {
  client: typeof import('../../services/client');
  ha: typeof import('../../services/ha');
  petkit: typeof import('../../services/petkit');
  user: typeof import('../../services/user');
  energy: typeof import('../../services/energy');
  errors: typeof import('../../services/errors');
}

/**
 * Reloads the API client and every domain module from a clean module registry.
 * `client.ts` keeps its refresh state (in-flight promise, cooldown, handlers) at module
 * level: without a fresh copy, one test's refresh would leak into the next.
 *
 * @returns The freshly imported modules.
 */
export const loadFreshServices = async (): Promise<FreshServices> => {
  vi.resetModules();
  const [client, ha, petkit, user, energy, errors] = await Promise.all([
    import('../../services/client'),
    import('../../services/ha'),
    import('../../services/petkit'),
    import('../../services/user'),
    import('../../services/energy'),
    import('../../services/errors'),
  ]);
  return { client, ha, petkit, user, energy, errors };
};

/**
 * Silences the logger's console output for the current test (spies are restored by Vitest).
 *
 * @returns The console spies, to assert on what was logged.
 */
export const silenceConsole = () => ({
  log: vi.spyOn(console, 'log').mockImplementation(() => undefined),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => undefined),
  error: vi.spyOn(console, 'error').mockImplementation(() => undefined),
});

/** Minimal shape of an error raised by `traceApi` callbacks. */
export interface StatusError extends Error {
  status?: number;
  code?: string;
}

/**
 * Builds an error carrying an HTTP status, like `ApiError`, without depending on it.
 *
 * @param status - HTTP status.
 * @param message - Error message.
 * @param code - Optional backend error code.
 * @returns The error.
 */
export const statusError = (status: number, message = `Error ${status}`, code?: string) =>
  Object.assign(new Error(message), { status, code }) as StatusError;
