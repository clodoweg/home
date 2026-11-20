/** logger tests — dev-only traces, always-on errors, and the API timing icons. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { silenceConsole } from '../test/services/helpers';

type LoggerModule = typeof import('./logger');

/** Loads the logger with `import.meta.env.DEV` forced, since it is read once at import. */
const loadLogger = async (isDev: boolean): Promise<LoggerModule> => {
  vi.stubEnv('DEV', isDev);
  vi.resetModules();
  return import('./logger');
};

afterEach(() => {
  vi.useRealTimers();
});

describe('logger in development', () => {
  it('prefixes info, warn and error with a fr-FR time and milliseconds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 23, 9, 5, 7, 42));
    const spies = silenceConsole();
    const { logger } = await loadLogger(true);

    logger.info('hello', 1);
    logger.warn('careful');
    logger.error('broken', { a: 1 });

    expect(spies.log).toHaveBeenCalledWith('[09:05:07.042]', 'hello', 1);
    expect(spies.warn).toHaveBeenCalledWith('[09:05:07.042]', 'careful');
    expect(spies.error).toHaveBeenCalledWith('[09:05:07.042]', 'broken', { a: 1 });
  });

  it('traces API start, failure and secure messages', async () => {
    const spies = silenceConsole();
    const { logger } = await loadLogger(true);
    const error = new Error('x');

    logger.api.start('id1', 'getStates');
    logger.api.fail('id1', 'getStates', 12, error);
    logger.secure('token refreshed');

    expect(spies.log).toHaveBeenCalledWith(
      expect.stringMatching(/➡️ \[API id1\] START getStates$/),
    );
    expect(spies.error).toHaveBeenCalledWith(
      expect.stringMatching(/❌ \[API id1\] FAIL getStates \(12ms\)$/),
      error,
    );
    expect(spies.log).toHaveBeenCalledWith(expect.stringMatching(/🔐 token refreshed$/));
  });

  it.each([
    [0, '✅'],
    [499, '✅'],
    [500, '⚠️'],
    [999, '⚠️'],
    [1000, '🐢'],
  ])('marks a %i ms call with %s', async (duration, icon) => {
    const spies = silenceConsole();
    const { logger } = await loadLogger(true);

    logger.api.done('id', 'call', duration);

    expect(spies.log).toHaveBeenCalledWith(
      expect.stringContaining(`${icon} [API id] DONE call (${duration}ms)`),
    );
  });
});

describe('logger in production', () => {
  it('drops info, warn, API start/done and secure logs', async () => {
    const spies = silenceConsole();
    const { logger } = await loadLogger(false);

    logger.info('x');
    logger.warn('x');
    logger.api.start('id', 'x');
    logger.api.done('id', 'x', 1);
    logger.secure('x');

    expect(spies.log).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
  });

  it('keeps errors and API failures', async () => {
    const spies = silenceConsole();
    const { logger } = await loadLogger(false);

    logger.error('boom');
    logger.api.fail('id', 'x', 3, 'err');

    expect(spies.error).toHaveBeenCalledTimes(2);
  });
});
