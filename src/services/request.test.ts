/** request tests — headers, query encoding, timeout, cancellation, 401 retry and typed errors. */
import { http, HttpResponse, delay } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw-server';
import { API_URL, setOnUnauthorized, setTokenProvider, setTokenRefreshHandler } from './client';
import { RequestTimeoutError, pathSegment, request } from './request';

afterEach(() => {
  setTokenProvider(null);
  setTokenRefreshHandler(null);
  setOnUnauthorized(() => {});
  vi.useRealTimers();
});

describe('request', () => {
  it('sends the bearer token and a request id, without Content-Type on a GET', async () => {
    let headers: Headers | undefined;
    server.use(
      http.get(`${API_URL}/api/ha/scenes`, ({ request: req }) => {
        headers = req.headers;
        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(request('jwt', '/api/ha/scenes')).resolves.toEqual({ ok: true });
    expect(headers?.get('Authorization')).toBe('Bearer jwt');
    expect(headers?.get('X-Request-Id')).toBeTruthy();
    expect(headers?.get('Content-Type')).toBeNull();
  });

  it('encodes the query and drops undefined values', async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API_URL}/api/grdf`, ({ request: req }) => {
        url = new URL(req.url);
        return HttpResponse.json({});
      }),
    );

    await request('jwt', '/api/grdf', { query: { start: 'a&b=c', end: undefined, days: 7 } });

    expect(url?.searchParams.get('start')).toBe('a&b=c');
    expect(url?.searchParams.has('end')).toBe(false);
    expect(url?.searchParams.get('days')).toBe('7');
  });

  it('posts a JSON body with its Content-Type', async () => {
    let received: { contentType: string | null; body: unknown } | undefined;
    server.use(
      http.post(`${API_URL}/api/ha/call`, async ({ request: req }) => {
        received = { contentType: req.headers.get('Content-Type'), body: await req.json() };
        return HttpResponse.json([]);
      }),
    );

    await request('jwt', '/api/ha/call', { method: 'POST', body: { domain: 'light' } });

    expect(received).toEqual({ contentType: 'application/json', body: { domain: 'light' } });
  });

  it('reads text or nothing when asked', async () => {
    server.use(
      http.get(`${API_URL}/api/text`, () => HttpResponse.text('20.5')),
      http.post(`${API_URL}/api/none`, () => new HttpResponse(null, { status: 204 })),
    );
    await expect(request('jwt', '/api/text', { responseType: 'text' })).resolves.toBe('20.5');
    await expect(
      request('jwt', '/api/none', { method: 'POST', responseType: 'none' }),
    ).resolves.toBeUndefined();
  });

  it('throws an ApiError with the status and code of an error answer', async () => {
    server.use(
      http.get(`${API_URL}/api/ha/states`, () =>
        HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }),
      ),
    );
    await expect(request('jwt', '/api/ha/states')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('refreshes the token once and retries after a 401', async () => {
    setTokenRefreshHandler(async () => 'fresh');
    server.use(
      http.get(`${API_URL}/api/ha/states`, ({ request: req }) =>
        req.headers.get('Authorization') === 'Bearer fresh'
          ? HttpResponse.json(['ok'])
          : new HttpResponse(null, { status: 401 }),
      ),
    );
    await expect(request('stale', '/api/ha/states')).resolves.toEqual(['ok']);
  });

  it('gives up after its timeout with a RequestTimeoutError', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(
      http.get(`${API_URL}/api/slow`, async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );

    const pending = request('jwt', '/api/slow', { timeoutMs: 1_000, name: 'slow' });
    const outcome = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(1_100);
    await outcome;
    await expect(pending).rejects.toThrow('slow timed out after 1s');
  });

  it('aborts when the caller cancels, and does not start when already cancelled', async () => {
    server.use(
      http.get(`${API_URL}/api/slow`, async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );
    const controller = new AbortController();
    const pending = request('jwt', '/api/slow', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(request('jwt', '/api/slow', { signal: controller.signal })).rejects.toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('B21: asks Clerk for the current token instead of sending the stored one', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${API_URL}/api/ha/states`, ({ request: req }) => {
        seen.push(req.headers.get('Authorization'));
        return HttpResponse.json([]);
      }),
    );

    setTokenProvider(async () => 'fresh');
    await request('stored', '/api/ha/states');
    // Offline (Clerk throws) or nothing returned: the stored token is still sent.
    setTokenProvider(async () => {
      throw new Error('offline');
    });
    await request('stored', '/api/ha/states');
    setTokenProvider(async () => null);
    await request('stored', '/api/ha/states');

    expect(seen).toEqual(['Bearer fresh', 'Bearer stored', 'Bearer stored']);
  });

  it('B21: falls back to the stored token when Clerk does not answer in time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${API_URL}/api/ha/states`, ({ request: req }) => {
        seen.push(req.headers.get('Authorization'));
        return HttpResponse.json([]);
      }),
    );
    setTokenProvider(() => new Promise<string>(() => {}));

    const pending = request('stored', '/api/ha/states');
    await vi.advanceTimersByTimeAsync(3_000);
    await pending;

    expect(seen).toEqual(['Bearer stored']);
    vi.useRealTimers();
  });

  it('refuses to call the back without a token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(request(null, '/api/ha/states')).rejects.toThrow('No token');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('pathSegment', () => {
  it('keeps a value inside one path segment', () => {
    expect(pathSegment('camera.a/../b?x=1#y')).toBe('camera.a%2F..%2Fb%3Fx%3D1%23y');
  });
});
