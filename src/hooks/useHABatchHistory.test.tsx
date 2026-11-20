/** useHABatchHistory tests — per-entity mapping, request shape, gating and error handling. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, setTokenRefreshHandler } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { useHABatchHistory } from './useHABatchHistory';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const NOW = new Date('2026-10-23T12:33:20+02:00');

interface ReceivedRequest {
  url: URL;
  authorization: string | null;
}

let requests: ReceivedRequest[] = [];

/** Serves the batch history endpoint with a fixed response. */
function serveBatch(response: () => Response) {
  server.use(
    http.get(`${API_URL}/api/ha/history/period/:start`, ({ request }) => {
      requests.push({
        url: new URL(request.url),
        authorization: request.headers.get('Authorization'),
      });
      return response();
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
  setTokenRefreshHandler(null);
});

describe('useHABatchHistory', () => {
  it('indexes the points of each entity by the entity id of its first point', async () => {
    serveBatch(() =>
      HttpResponse.json([
        [
          { entity_id: 'sensor.a', state: '1', last_changed: 't1', attributes: { x: 1 } },
          { entity_id: 'sensor.a', state: '2', last_changed: 't2' },
        ],
        [],
        [{ entity_id: 'sensor.b', state: 'on', last_changed: 't3' }],
      ]),
    );
    const client = createTestQueryClient();

    const { result } = renderHook(
      () => useHABatchHistory({ entityIds: ['sensor.a', 'sensor.b'] }),
      { wrapper: createQueryWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      'sensor.a': [
        { state: '1', last_changed: 't1' },
        { state: '2', last_changed: 't2' },
      ],
      'sensor.b': [{ state: 'on', last_changed: 't3' }],
    });
  });

  it('asks for a 2-hour window ending on the current 5-minute boundary', async () => {
    serveBatch(() => HttpResponse.json([]));
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHABatchHistory({ entityIds: ['sensor.a'] }), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { url, authorization } = requests[0];
    expect(decodeURIComponent(url.pathname)).toBe(
      '/api/ha/history/period/2026-10-23T08:30:00.000Z',
    );
    expect(url.searchParams.get('end_time')).toBe('2026-10-23T10:30:00.000Z');
    expect(authorization).toBe('Bearer jwt');
  });

  it('honours a custom number of hours in the window and the query key', async () => {
    serveBatch(() => HttpResponse.json([]));
    const client = createTestQueryClient();
    const ids = ['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d'];

    const { result } = renderHook(() => useHABatchHistory({ entityIds: ids, hours: 6 }), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(decodeURIComponent(requests[0].url.pathname)).toBe(
      '/api/ha/history/period/2026-10-23T04:30:00.000Z',
    );
    expect(requests[0].url.searchParams.get('filter_entity_id')).toBe(ids.join(','));
    expect(client.getQueryData(['ha', 'history-batch', ids, 6])).toEqual({});
  });

  it('returns an empty map when the body is not an array', async () => {
    serveBatch(() => HttpResponse.json({ unexpected: true }));
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHABatchHistory({ entityIds: ['sensor.a'] }), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({});
  });

  it.each([
    ['there is no token', { token: null, entityIds: ['sensor.a'], enabled: true }],
    ['the id list is empty', { token: 'jwt', entityIds: [], enabled: true }],
    ['the caller disables it', { token: 'jwt', entityIds: ['sensor.a'], enabled: false }],
  ])('does not fetch when %s', (_label, { token, entityIds, enabled }) => {
    profile.token = token;
    serveBatch(() => HttpResponse.json([]));
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHABatchHistory({ entityIds, enabled }), {
      wrapper: createQueryWrapper(client),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(requests).toHaveLength(0);
  });

  it('resolves to an empty map without a request when refetched with an empty id list', async () => {
    serveBatch(() => HttpResponse.json([]));
    const client = createTestQueryClient();
    const { result } = renderHook(() => useHABatchHistory({ entityIds: [] }), {
      wrapper: createQueryWrapper(client),
    });

    const refetched = await result.current.refetch();

    expect(refetched.data).toEqual({});
    expect(requests).toHaveLength(0);
  });

  it('fails with the status of a non-ok response', async () => {
    serveBatch(() => HttpResponse.json({ error: 'down' }, { status: 502 }));
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHABatchHistory({ entityIds: ['sensor.a'] }), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 502 });
  });

  describe('fixed bugs (regressions)', () => {
    it('B13: retries with a refreshed token after a 401', async () => {
      setTokenRefreshHandler(async () => 'fresh');
      server.use(
        http.get(`${API_URL}/api/ha/history/period/:start`, ({ request }) => {
          requests.push({
            url: new URL(request.url),
            authorization: request.headers.get('Authorization'),
          });
          return request.headers.get('Authorization') === 'Bearer fresh'
            ? HttpResponse.json([])
            : HttpResponse.json({ error: 'expired' }, { status: 401 });
        }),
      );
      const client = createTestQueryClient();

      const { result } = renderHook(() => useHABatchHistory({ entityIds: ['sensor.a'] }), {
        wrapper: createQueryWrapper(client),
      });

      await waitFor(() => expect(result.current.isFetched).toBe(true));
      expect(result.current.isSuccess).toBe(true);
      expect(requests.map((r) => r.authorization)).toEqual(['Bearer jwt', 'Bearer fresh']);
    });
  });
});
