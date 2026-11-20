/** ha tests — Home Assistant client: requests sent, responses mapped, and error handling per call. */
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIGHT_STATES } from '../../e2e/fixtures/mock-data/ha-states';
import { server } from '../test/msw-server';
import { type FreshServices, loadFreshServices, silenceConsole } from '../test/services/helpers';
import { API_URL } from './client';

let client: FreshServices['client'];
let ha: FreshServices['ha'];

beforeEach(async () => {
  ({ client, ha } = await loadFreshServices());
  silenceConsole();
});

afterEach(() => {
  vi.useRealTimers();
});

const bearer = (request: Request) => request.headers.get('Authorization');

/** Answers 401 to a stale token and delegates to `onFresh` for the refreshed one. */
const rejectsStaleToken =
  (onFresh: () => Response) =>
  ({ request }: { request: Request }) =>
    bearer(request) === 'Bearer fresh'
      ? onFresh()
      : HttpResponse.json({ error: 'expired', code: 'UNAUTHORIZED' }, { status: 401 });

describe('getScenes', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(ha.getScenes('')).rejects.toThrow('No token');
  });

  it('returns the scene configuration', async () => {
    const scenes = { 'scene.soir': { brightness: 40 } };
    server.use(
      http.get(`${API_URL}/api/ha/scenes`, ({ request }) => {
        expect(bearer(request)).toBe('Bearer jwt');
        expect(request.headers.get('X-Request-Id')).toBeTruthy();
        return HttpResponse.json(scenes);
      }),
    );
    await expect(ha.getScenes('jwt')).resolves.toEqual(scenes);
  });
});

describe('getStates', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(ha.getStates('')).rejects.toThrow('No token');
  });

  it('returns the states', async () => {
    server.use(http.get(`${API_URL}/api/ha/states`, () => HttpResponse.json(LIGHT_STATES)));
    await expect(ha.getStates('jwt')).resolves.toEqual(LIGHT_STATES);
  });

  it('throws an ApiError on a non-2xx response', async () => {
    server.use(
      http.get(`${API_URL}/api/ha/states`, () =>
        HttpResponse.json({ error: 'HA down' }, { status: 502 }),
      ),
    );
    await expect(ha.getStates('jwt')).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
      message: 'Error 502: HA down',
    });
  });

  it('refreshes the token and retries on a 401', async () => {
    client.setTokenRefreshHandler(async () => 'fresh');
    server.use(
      http.get(
        `${API_URL}/api/ha/states`,
        rejectsStaleToken(() => HttpResponse.json(LIGHT_STATES)),
      ),
    );
    await expect(ha.getStates('stale')).resolves.toEqual(LIGHT_STATES);
  });

  it('rethrows a network error', async () => {
    server.use(http.get(`${API_URL}/api/ha/states`, () => HttpResponse.error()));
    await expect(ha.getStates('jwt')).rejects.toBeInstanceOf(TypeError);
  });

  it('passes on a cancellation that is not its own timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(ha.getStates('jwt')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('aborts the request after 10 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let signal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      signal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      );
    });

    const outcome = ha.getStates('jwt').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    await expect(outcome).resolves.toMatchObject({
      name: 'RequestTimeoutError',
      message: 'getStates timed out after 10s',
    });
  });
});

describe('executeAction', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(ha.executeAction('', 'light', 'turn_on', 'light.a')).rejects.toThrow('No token');
  });

  it('posts the service call and wraps the response', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/api/ha/call`, async ({ request }) => {
        body = await request.json();
        expect(request.headers.get('Content-Type')).toBe('application/json');
        return HttpResponse.json([{ entity_id: 'light.a', state: 'on' }]);
      }),
    );

    await expect(
      ha.executeAction('jwt', 'light', 'turn_on', 'light.a', { brightness: 128 }),
    ).resolves.toEqual({ success: true, data: [{ entity_id: 'light.a', state: 'on' }] });
    expect(body).toEqual({
      domain: 'light',
      service: 'turn_on',
      entity_id: 'light.a',
      service_data: { brightness: 128 },
    });
  });

  it('sends several entities, empty service data by default, and return_response on demand', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/api/ha/call`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ response: { forecast: [] } });
      }),
    );

    await ha.executeAction(
      'jwt',
      'weather',
      'get_forecasts',
      ['weather.a', 'weather.b'],
      undefined,
      true,
    );

    expect(body).toEqual({
      domain: 'weather',
      service: 'get_forecasts',
      entity_id: ['weather.a', 'weather.b'],
      service_data: {},
      return_response: true,
    });
  });

  it('rejects when the request fails, so callers can roll back', async () => {
    server.use(http.post(`${API_URL}/api/ha/call`, () => HttpResponse.error()));
    await expect(ha.executeAction('jwt', 'switch', 'toggle', 'switch.a')).rejects.toThrow();
  });

  it('rejects with the status and code of an error answer', async () => {
    server.use(
      http.post(`${API_URL}/api/ha/call`, () =>
        HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }),
      ),
    );
    await expect(ha.executeAction('jwt', 'switch', 'toggle', 'switch.a')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });
});

describe('getEntityMetadata', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(ha.getEntityMetadata('')).rejects.toThrow('No token');
  });

  it('reads the metadata of the back (template fixed server-side)', async () => {
    const metadata = { 'light.a': { area: 'Salon "TV"', floor: '', model: 'Hue' } };
    server.use(http.get(`${API_URL}/api/ha/metadata`, () => HttpResponse.json(metadata)));
    await expect(ha.getEntityMetadata('jwt')).resolves.toEqual(metadata);
  });

  it('throws an ApiError when HA fails (502)', async () => {
    server.use(
      http.get(`${API_URL}/api/ha/metadata`, () =>
        HttpResponse.json({ error: 'Home Assistant error' }, { status: 502 }),
      ),
    );
    await expect(ha.getEntityMetadata('jwt')).rejects.toMatchObject({ status: 502 });
  });
});

describe('getWeatherForecast', () => {
  it('asks for one entity and granularity and returns the entries', async () => {
    let query: URLSearchParams | undefined;
    const forecast = [{ datetime: '2026-10-26T11:00:00+00:00', condition: 'sunny' }];
    server.use(
      http.get(`${API_URL}/api/ha/forecast`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json(forecast);
      }),
    );

    await expect(ha.getWeatherForecast('jwt', 'weather.maison', 'hourly')).resolves.toEqual(
      forecast,
    );
    expect(query?.get('entity_id')).toBe('weather.maison');
    expect(query?.get('type')).toBe('hourly');
  });

  it('throws an ApiError when the back refuses', async () => {
    server.use(
      http.get(`${API_URL}/api/ha/forecast`, () =>
        HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
      ),
    );
    await expect(ha.getWeatherForecast('jwt', 'weather.maison', 'daily')).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('roundTo5Min', () => {
  it('rounds down to the 5-minute bucket and mutates its argument', () => {
    const date = new Date('2026-10-23T10:47:33.250Z');
    const rounded = ha.roundTo5Min(date);
    expect(rounded).toBe(date);
    expect(rounded.toISOString()).toBe('2026-10-23T10:45:00.000Z');
  });

  it('keeps a date already on a bucket', () => {
    expect(ha.roundTo5Min(new Date('2026-10-23T10:50:00.000Z')).toISOString()).toBe(
      '2026-10-23T10:50:00.000Z',
    );
  });
});

describe('getHistory', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(ha.getHistory('', 'sensor.t')).rejects.toThrow('No token');
  });

  it('queries a window ending on the current 5-minute bucket and maps the first series', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T10:47:33.000Z'));
    let query: URLSearchParams | undefined;
    server.use(
      http.get(`${API_URL}/api/ha/history`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json([
          [
            { state: '20', last_changed: 't1', attributes: { unit: '°C' }, extra: true },
            { state: '21', last_changed: 't2' },
          ],
          [{ state: 'ignored', last_changed: 't3' }],
        ]);
      }),
    );

    await expect(ha.getHistory('jwt', 'sensor.t', 2)).resolves.toEqual([
      { state: '20', last_changed: 't1', attributes: { unit: '°C' } },
      { state: '21', last_changed: 't2', attributes: undefined },
    ]);
    expect(query?.get('entity_id')).toBe('sensor.t');
    expect(query?.get('end_time')).toBe('2026-10-23T10:45:00.000Z');
    expect(query?.get('start_time')).toBe('2026-10-23T08:45:00.000Z');
  });

  it('defaults to a 24 h window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T10:00:00.000Z'));
    let query: URLSearchParams | undefined;
    server.use(
      http.get(`${API_URL}/api/ha/history`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json([[]]);
      }),
    );

    await expect(ha.getHistory('jwt', 'sensor.t')).resolves.toEqual([]);
    expect(query?.get('start_time')).toBe('2026-10-22T10:00:00.000Z');
  });

  it.each([[[]], [null]])('returns [] when the back answers %j', async (payload) => {
    server.use(http.get(`${API_URL}/api/ha/history`, () => HttpResponse.json(payload)));
    await expect(ha.getHistory('jwt', 'sensor.t')).resolves.toEqual([]);
  });

  it('throws an ApiError on a non-2xx response', async () => {
    server.use(
      http.get(`${API_URL}/api/ha/history`, () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    );
    await expect(ha.getHistory('jwt', 'sensor.t')).rejects.toMatchObject({ status: 403 });
  });
});

describe('triggerArloSnapshot', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(ha.triggerArloSnapshot('', 'camera.a')).rejects.toThrow('No token');
  });

  it('posts with the bearer token and no JSON content type', async () => {
    server.use(
      http.post(`${API_URL}/api/arlo/snapshot/:entityId`, ({ request }) => {
        expect(bearer(request)).toBe('Bearer jwt');
        expect(request.headers.get('Content-Type')).toBeNull();
        return HttpResponse.json({});
      }),
    );
    await expect(ha.triggerArloSnapshot('jwt', 'camera.a')).resolves.toBe(true);
  });

  it('rejects when the request fails or the back refuses', async () => {
    server.use(http.post(`${API_URL}/api/arlo/snapshot/:entityId`, () => HttpResponse.error()));
    await expect(ha.triggerArloSnapshot('jwt', 'camera.a')).rejects.toThrow();
    server.use(
      http.post(`${API_URL}/api/arlo/snapshot/:entityId`, () =>
        HttpResponse.json({ error: 'Bad gateway' }, { status: 502 }),
      ),
    );
    await expect(ha.triggerArloSnapshot('jwt', 'camera.a')).rejects.toMatchObject({ status: 502 });
  });
});

describe('fixed bugs (regressions)', () => {
  it('B01: executeAction refreshes the token and retries after a 401', async () => {
    client.setTokenRefreshHandler(async () => 'fresh');
    server.use(
      http.post(
        `${API_URL}/api/ha/call`,
        rejectsStaleToken(() => HttpResponse.json([])),
      ),
    );
    await expect(ha.executeAction('stale', 'light', 'turn_on', 'light.a')).resolves.toEqual({
      success: true,
      data: [],
    });
  });

  it('B01: executeAction lets a 403 IP_RESTRICTED reach the UI', async () => {
    const onUnauthorized = vi.fn();
    client.setOnUnauthorized(onUnauthorized);
    server.use(
      http.post(`${API_URL}/api/ha/call`, () =>
        HttpResponse.json({ error: 'IP', code: 'IP_RESTRICTED' }, { status: 403 }),
      ),
    );
    await ha.executeAction('jwt', 'light', 'turn_on', 'light.a').catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledWith(expect.any(String), 403);
  });

  it('B01: triggerArloSnapshot refreshes the token and retries after a 401', async () => {
    client.setTokenRefreshHandler(async () => 'fresh');
    server.use(
      http.post(
        `${API_URL}/api/arlo/snapshot/:entityId`,
        rejectsStaleToken(() => HttpResponse.json({})),
      ),
    );
    await expect(ha.triggerArloSnapshot('stale', 'camera.a')).resolves.toBe(true);
  });

  it('B01: getScenes refreshes the token and retries after a 401', async () => {
    client.setTokenRefreshHandler(async () => 'fresh');
    server.use(
      http.get(
        `${API_URL}/api/ha/scenes`,
        rejectsStaleToken(() => HttpResponse.json({ 'scene.a': { brightness: 10 } })),
      ),
    );
    await expect(ha.getScenes('stale')).resolves.toEqual({ 'scene.a': { brightness: 10 } });
  });
});
