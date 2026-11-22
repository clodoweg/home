/** client tests — traceApi logging, 401 refresh + retry (anti-stampede), 401/403 surfacing, auth headers. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from './client';
import { loadFreshServices, silenceConsole, statusError } from '../test/services/helpers';

type Client = typeof import('./client');

let client: Client;
let consoleSpies: ReturnType<typeof silenceConsole>;

beforeEach(async () => {
  ({ client } = await loadFreshServices());
  consoleSpies = silenceConsole();
});

/** A traceApi callback that fails with `error` until it receives `acceptedToken`. */
const failsUntilToken = (error: unknown, acceptedToken: string) =>
  vi.fn(async (_requestId: string, currentToken?: string) => {
    if (currentToken === acceptedToken) return `ok:${currentToken}`;
    throw error;
  });

describe('API_URL and isBackendApiUrl', () => {
  it('exposes an absolute backend URL', () => {
    expect(client.API_URL).toBe(API_URL);
    expect(() => new URL(client.API_URL)).not.toThrow();
  });

  it.each([
    [`${API_URL}/api/ha/states`, true],
    ['/api/user/me', true],
    ['/health', false],
    ['https://cdn.example.com/api/x', false],
    ['http://[invalid', false],
  ])('classifies %s as backend API: %s', (url, expected) => {
    expect(client.isBackendApiUrl(url)).toBe(expected);
  });
});

describe('traceApi — success', () => {
  it('passes a request id and the original token, and returns the result', async () => {
    const fn = vi.fn(
      async (requestId: string, token?: string) => `${requestId.length > 0}:${token}`,
    );

    await expect(client.traceApi('ok', fn, 'tok')).resolves.toBe('true:tok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(consoleSpies.log).toHaveBeenCalledWith(expect.stringContaining('START ok'));
    expect(consoleSpies.log).toHaveBeenCalledWith(expect.stringContaining('DONE ok'));
  });
});

describe('traceApi — errors other than 401/403', () => {
  it('rethrows a 500 without calling the unauthorized callback or the refresh handler', async () => {
    const onUnauthorized = vi.fn();
    const refresh = vi.fn(async () => 'fresh');
    client.setOnUnauthorized(onUnauthorized);
    client.setTokenRefreshHandler(refresh);
    const error = statusError(500);

    await expect(client.traceApi('boom', async () => Promise.reject(error), 'tok')).rejects.toBe(
      error,
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(consoleSpies.error).toHaveBeenCalledWith(expect.stringContaining('FAIL boom'), error);
  });

  it('rethrows an error without status', async () => {
    const error = new Error('network');
    await expect(client.traceApi('net', async () => Promise.reject(error))).rejects.toBe(error);
  });

  it('rethrows a rejection with null as is', async () => {
    await expect(client.traceApi('null', async () => Promise.reject(null))).rejects.toBeNull();
  });
});

describe('traceApi — 401 without refresh handler', () => {
  it('notifies the session expiry and rethrows', async () => {
    const onUnauthorized = vi.fn();
    client.setOnUnauthorized(onUnauthorized);
    const error = statusError(401);

    await expect(client.traceApi('x', async () => Promise.reject(error))).rejects.toBe(error);
    expect(onUnauthorized).toHaveBeenCalledWith('Session expirée. Reconnexion en cours...', 401);
  });

  it('rethrows when no unauthorized callback is registered', async () => {
    const error = statusError(401);
    await expect(client.traceApi('x', async () => Promise.reject(error))).rejects.toBe(error);
  });

  it('treats a handler reset to null as no handler', async () => {
    const refresh = vi.fn(async () => 'fresh');
    client.setTokenRefreshHandler(refresh);
    client.setTokenRefreshHandler(null);

    await expect(
      client.traceApi('x', async () => Promise.reject(statusError(401))),
    ).rejects.toThrow();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('traceApi — 401 with refresh handler', () => {
  it('refreshes the token and retries once with it', async () => {
    const onUnauthorized = vi.fn();
    client.setOnUnauthorized(onUnauthorized);
    const refresh = vi.fn(async () => 'fresh');
    client.setTokenRefreshHandler(refresh);
    const fn = failsUntilToken(statusError(401), 'fresh');

    await expect(client.traceApi('x', fn, 'stale')).resolves.toBe('ok:fresh');
    expect(fn.mock.calls.map(([, token]) => token)).toEqual(['stale', 'fresh']);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(consoleSpies.log).toHaveBeenCalledWith(expect.stringContaining('DONE x (retried)'));
  });

  it('does not retry and surfaces the 401 when the refresh yields no token', async () => {
    const onUnauthorized = vi.fn();
    client.setOnUnauthorized(onUnauthorized);
    client.setTokenRefreshHandler(async () => null);
    const error = statusError(401);
    const fn = vi.fn(async () => Promise.reject(error));

    await expect(client.traceApi('x', fn, 'stale')).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledWith(expect.any(String), 401);
  });

  it('logs a failing refresh and rethrows the original 401', async () => {
    const onUnauthorized = vi.fn();
    client.setOnUnauthorized(onUnauthorized);
    client.setTokenRefreshHandler(async () => Promise.reject(new Error('clerk down')));
    const error = statusError(401);

    await expect(client.traceApi('x', async () => Promise.reject(error))).rejects.toBe(error);
    expect(consoleSpies.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Token refresh failed'),
      expect.objectContaining({ message: 'clerk down' }),
    );
    expect(onUnauthorized).toHaveBeenCalledWith(expect.any(String), 401);
  });

  it('allows a new refresh right after a failed one (no cooldown is recorded)', async () => {
    const refresh = vi
      .fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new Error('clerk down'))
      .mockResolvedValueOnce('fresh');
    client.setTokenRefreshHandler(refresh);

    await expect(
      client.traceApi('a', failsUntilToken(statusError(401), 'fresh')),
    ).rejects.toThrow();
    await expect(client.traceApi('b', failsUntilToken(statusError(401), 'fresh'))).resolves.toBe(
      'ok:fresh',
    );
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('shares one refresh between parallel 401s and retries each call with the new token', async () => {
    let resolveRefresh: (token: string) => void = (_token) => undefined;
    const refresh = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    client.setTokenRefreshHandler(refresh);
    const fnA = failsUntilToken(statusError(401), 'fresh');
    const fnB = failsUntilToken(statusError(401), 'fresh');

    const callA = client.traceApi('a', fnA, 'stale');
    const callB = client.traceApi('b', fnB, 'stale');
    await vi.waitFor(() => expect(fnB).toHaveBeenCalledTimes(1));
    resolveRefresh('fresh');

    await expect(Promise.all([callA, callB])).resolves.toEqual(['ok:fresh', 'ok:fresh']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes again once the 2 s cooldown has elapsed', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const refresh = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('fresh-1')
      .mockResolvedValueOnce('fresh-2');
    client.setTokenRefreshHandler(refresh);

    await client.traceApi('a', failsUntilToken(statusError(401), 'fresh-1'));
    now.mockReturnValue(1_002_001);

    await expect(client.traceApi('b', failsUntilToken(statusError(401), 'fresh-2'))).resolves.toBe(
      'ok:fresh-2',
    );
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

describe('traceApi — 403', () => {
  it.each([
    ['the IP_RESTRICTED code', statusError(403, 'Forbidden', 'IP_RESTRICTED')],
    ['IP_RESTRICTED in the message', statusError(403, 'Error 403: IP_RESTRICTED')],
  ])('maps %s to the home Wi-Fi message', async (_label, error) => {
    const onUnauthorized = vi.fn();
    client.setOnUnauthorized(onUnauthorized);

    await expect(client.traceApi('x', async () => Promise.reject(error))).rejects.toBe(error);
    expect(onUnauthorized).toHaveBeenCalledWith(
      "L'application doit être connectée au WIFI de la maison pour fonctionner",
      403,
    );
  });

  it.each([
    ['the USER_NOT_FOUND code', statusError(403, 'Forbidden', 'USER_NOT_FOUND')],
    ['the French message', statusError(403, 'Error 403: Utilisateur non autorisé (x)')],
  ])('maps %s to the unknown user message', async (_label, error) => {
    const onUnauthorized = vi.fn();
    client.setOnUnauthorized(onUnauthorized);

    await expect(client.traceApi('x', async () => Promise.reject(error))).rejects.toBe(error);
    expect(onUnauthorized).toHaveBeenCalledWith('Utilisateur non autorisé', 403);
  });

  it('leaves any other 403 to local handling', async () => {
    const onUnauthorized = vi.fn();
    client.setOnUnauthorized(onUnauthorized);
    const error = statusError(403, 'Error 403: Accès refusé');

    await expect(client.traceApi('x', async () => Promise.reject(error))).rejects.toBe(error);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(consoleSpies.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('local handling'),
    );
  });

  it('handles a 403 without message', async () => {
    const onUnauthorized = vi.fn();
    client.setOnUnauthorized(onUnauthorized);
    const error = { status: 403 };

    await expect(client.traceApi('x', async () => Promise.reject(error))).rejects.toBe(error);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not try to refresh the token on a 403', async () => {
    const refresh = vi.fn(async () => 'fresh');
    client.setTokenRefreshHandler(refresh);

    await expect(
      client.traceApi('x', async () => Promise.reject(statusError(403, 'x', 'IP_RESTRICTED'))),
    ).rejects.toThrow();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('rethrows a global 403 when no unauthorized callback is registered', async () => {
    const error = statusError(403, 'x', 'USER_NOT_FOUND');
    await expect(client.traceApi('x', async () => Promise.reject(error))).rejects.toBe(error);
  });
});

describe('fixed bugs (regressions)', () => {
  it('B10: retries a 401 arriving within the cooldown with the last refreshed token', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    client.setTokenRefreshHandler(async () => 'fresh');

    await client.traceApi('a', failsUntilToken(statusError(401), 'fresh'));
    now.mockReturnValue(1_001_000);

    await expect(
      client.traceApi('b', failsUntilToken(statusError(401), 'fresh'), 'stale'),
    ).resolves.toBe('ok:fresh');
  });
});

describe('traceApi — failed retry', () => {
  it('surfaces the error of the retry, not the original 401', async () => {
    const onUnauthorized = vi.fn();
    client.setOnUnauthorized(onUnauthorized);
    client.setTokenRefreshHandler(async () => 'fresh');
    const serverError = statusError(500);
    const fn = vi.fn(async (_id: string, token?: string) => {
      throw token === 'fresh' ? serverError : statusError(401);
    });

    await expect(client.traceApi('x', fn, 'stale')).rejects.toBe(serverError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not open the cooldown when the refresh yields no token', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000_000);
    const refresh = vi.fn(async (): Promise<string | null> => null);
    client.setTokenRefreshHandler(refresh);

    await expect(
      client.traceApi('a', failsUntilToken(statusError(401), 'x'), 'stale'),
    ).rejects.toMatchObject({ status: 401 });
    refresh.mockResolvedValue('fresh');
    await expect(
      client.traceApi('b', failsUntilToken(statusError(401), 'fresh'), 'stale'),
    ).resolves.toBe('ok:fresh');
  });
});

describe('traceApi — session change', () => {
  it('never reuses the refreshed token of a previous session', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(7_000_000);
    client.setTokenRefreshHandler(async () => 'token-of-a');
    await client.traceApi('a', failsUntilToken(statusError(401), 'token-of-a'), 'stale-a');

    // Sign-out then another account, within the 2 s window.
    client.setTokenRefreshHandler(null);
    const refreshB = vi.fn(async () => 'token-of-b');
    client.setTokenRefreshHandler(refreshB);

    await expect(
      client.traceApi('b', failsUntilToken(statusError(401), 'token-of-b'), 'stale-b'),
    ).resolves.toBe('ok:token-of-b');
    expect(refreshB).toHaveBeenCalledTimes(1);
  });
});
