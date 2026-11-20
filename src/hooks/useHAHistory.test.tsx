/** useHAHistory tests — hourly bucketing, forward fill, live tail injection and query gating. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { useHAHistory } from './useHAHistory';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

// 12:30 in Paris: the 4-hour window covers the 09, 10, 11 and 12 hour buckets.
const NOW = new Date('2026-10-23T12:30:00+02:00');

interface RawPoint {
  state: string;
  last_changed: string;
  attributes?: Record<string, unknown>;
}

const POINTS: RawPoint[] = [
  { state: '8', last_changed: '2026-10-23T10:45:00+02:00', attributes: { temperature: 18 } },
  { state: '5', last_changed: '2026-10-23T08:10:00+02:00', attributes: { temperature: 15 } },
  { state: '7', last_changed: '2026-10-23T10:15:00+02:00', attributes: { temperature: 17 } },
  { state: 'unavailable', last_changed: '2026-10-23T11:00:00+02:00' },
];

let requests: URL[] = [];

/** Serves the single-entity history endpoint with the given points. */
function serveHistory(points: RawPoint[] = POINTS) {
  server.use(
    http.get(`${API_URL}/api/ha/history`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json([points]);
    }),
  );
}

beforeEach(() => {
  profile.token = 'jwt';
  requests = [];
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useHAHistory', () => {
  it('keeps the latest value of each hour and forward-fills empty hours', async () => {
    serveHistory();
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHAHistory({ entityId: 'sensor.temp', hours: 4 }), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.labels).toEqual(['09', '10', '11', '12']);
    // 09h has no point: it takes the last value before the window (08:10 → 5).
    expect(result.current.series).toEqual([5, 8, 8, 8]);
    expect(requests[0].searchParams.get('entity_id')).toBe('sensor.temp');
  });

  it('B25: starts the window with the value in effect before it, not the oldest one', async () => {
    serveHistory([
      { state: '3', last_changed: '2026-10-23T05:00:00+02:00' },
      { state: '6', last_changed: '2026-10-23T07:30:00+02:00' },
      { state: '9', last_changed: '2026-10-23T11:10:00+02:00' },
    ]);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHAHistory({ entityId: 'sensor.temp', hours: 4 }), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.series).toHaveLength(4));
    expect(result.current.series).toEqual([6, 6, 9, 9]);
  });

  it('defaults to a 24-hour window', async () => {
    serveHistory();
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHAHistory({ entityId: 'sensor.temp' }), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.series).toHaveLength(24));
    expect(result.current.labels[0]).toBe('13');
    expect(result.current.labels[23]).toBe('12');
  });

  it('reads the requested attribute instead of the state', async () => {
    serveHistory();
    const client = createTestQueryClient();

    const { result } = renderHook(
      () => useHAHistory({ entityId: 'climate.salon', hours: 4, attribute: 'temperature' }),
      { wrapper: createQueryWrapper(client) },
    );

    await waitFor(() => expect(result.current.series).toHaveLength(4));
    expect(result.current.series).toEqual([15, 18, 18, 18]);
    expect(
      client
        .getQueryCache()
        .find({ queryKey: ['ha', 'history', 'climate.salon', 4, 'temperature'] }),
    ).toBeDefined();
  });

  it('converts raw values with processValue', async () => {
    serveHistory([
      { state: 'on', last_changed: '2026-10-23T10:00:00+02:00' },
      { state: 'off', last_changed: '2026-10-23T12:05:00+02:00' },
    ]);
    const client = createTestQueryClient();

    const { result } = renderHook(
      () =>
        useHAHistory({
          entityId: 'switch.prise',
          hours: 4,
          processValue: (value: unknown) => (value === 'on' ? 1 : 0),
        }),
      { wrapper: createQueryWrapper(client) },
    );

    await waitFor(() => expect(result.current.series).toHaveLength(4));
    expect(result.current.series).toEqual([1, 1, 1, 0]);
  });

  it('fills the series with zeros when no point is numeric', async () => {
    serveHistory([{ state: 'unknown', last_changed: '2026-10-23T10:00:00+02:00' }]);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHAHistory({ entityId: 'sensor.x', hours: 3 }), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.series).toHaveLength(3));
    expect(result.current.series).toEqual([0, 0, 0]);
  });

  it('replaces the last point with the live current value', async () => {
    serveHistory();
    const client = createTestQueryClient();

    const { result, rerender } = renderHook(
      ({ currentValue }: { currentValue?: number }) =>
        useHAHistory({ entityId: 'sensor.temp', hours: 4, currentValue }),
      { wrapper: createQueryWrapper(client), initialProps: { currentValue: 21 } },
    );

    await waitFor(() => expect(result.current.series).toEqual([5, 8, 8, 21]));
    rerender({ currentValue: 0 });
    expect(result.current.series).toEqual([5, 8, 8, 0]);
    expect(client.getQueryData(['ha', 'history', 'sensor.temp', 4, 'state'])).toMatchObject({
      series: [5, 8, 8, 8],
    });
  });

  it('ignores the current value while the series is empty', () => {
    profile.token = null;
    const client = createTestQueryClient();

    const { result } = renderHook(
      () => useHAHistory({ entityId: 'sensor.temp', hours: 4, currentValue: 21 }),
      { wrapper: createQueryWrapper(client) },
    );

    expect(result.current.series).toEqual([]);
    expect(result.current.labels).toEqual([]);
  });

  it.each([
    ['there is no token', { token: null, entityId: 'sensor.temp', showHistory: true }],
    ['there is no entity', { token: 'jwt', entityId: undefined, showHistory: true }],
    ['history is hidden', { token: 'jwt', entityId: 'sensor.temp', showHistory: false }],
  ])('does not fetch when %s', (_label, { token, entityId, showHistory }) => {
    profile.token = token;
    serveHistory();
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHAHistory({ entityId, showHistory }), {
      wrapper: createQueryWrapper(client),
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.series).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it('refresh returns an empty series without a request when there is no entity', async () => {
    serveHistory();
    const client = createTestQueryClient();
    const { result } = renderHook(() => useHAHistory({}), { wrapper: createQueryWrapper(client) });

    const refreshed = await result.current.refresh();

    expect(refreshed.data).toEqual({ series: [], labels: [] });
    expect(requests).toHaveLength(0);
  });

  it('refresh fetches even when history is hidden', async () => {
    serveHistory();
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useHAHistory({ entityId: 'sensor.temp', hours: 2, showHistory: false }),
      { wrapper: createQueryWrapper(client) },
    );

    const refreshed = await result.current.refresh();

    expect(requests).toHaveLength(1);
    // Leading empty hours take the latest value before the window (10:45 → 8), B25.
    expect(refreshed.data?.series).toEqual([8, 8]);
  });
});
