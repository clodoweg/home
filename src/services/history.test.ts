/** history services tests — statistiques HA et compteurs d'usage : URL, jeton, erreurs. */
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from './client';
import { ApiError } from './errors';
import { getDailyUsage, getHAStatistics } from './history';
import { server } from '../test/msw-server';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('history services', () => {
  it('asks for the statistics of the window', async () => {
    let received: URL | undefined;
    server.use(
      http.get(`${API_URL}/api/ha/statistics`, ({ request }) => {
        received = new URL(request.url);
        return HttpResponse.json({ 'sensor.a': [{ start: '2026-11-01T00:00:00.000Z', mean: 20 }] });
      }),
    );
    const ids = ['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d'];
    const result = await getHAStatistics(
      'jwt',
      ids,
      new Date('2026-11-01T00:00:00Z'),
      new Date('2026-11-02T00:00:00Z'),
      'hour',
      ['mean', 'max'],
    );
    expect(result['sensor.a'][0].mean).toBe(20);
    expect(Object.fromEntries(received?.searchParams ?? [])).toEqual({
      statistic_ids: 'sensor.a,sensor.b,sensor.c,sensor.d',
      start: '2026-11-01T00:00:00.000Z',
      end: '2026-11-02T00:00:00.000Z',
      period: 'hour',
      types: 'mean,max',
    });
  });

  it('reads the usage counters and raises an ApiError when refused', async () => {
    server.use(
      http.get(`${API_URL}/api/history/usage`, ({ request }) => {
        const url = new URL(request.url);
        return url.searchParams.get('start') === '2026-11-01'
          ? HttpResponse.json({ washer_cycles: [{ date: '2026-11-02', value: 1 }] })
          : HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
      }),
    );
    expect(await getDailyUsage('jwt', '2026-11-01', '2026-11-30')).toEqual({
      washer_cycles: [{ date: '2026-11-02', value: 1 }],
    });
    await expect(getDailyUsage('jwt', '2025-01-01', '2026-11-30')).rejects.toBeInstanceOf(ApiError);
  });
});
