/** URL encoding tests — entity ids and dates never alter the path or the query of an API call. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw-server';
import { API_URL } from './client';
import { getHistory, triggerArloSnapshot } from './ha';
import { useHABatchHistory } from '../hooks/useHABatchHistory';

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => ({ token: 'jwt' }),
}));

const HOSTILE_ID = 'sensor.a&end_time=x/../../user/me#frag';

describe('services encode their parameters', () => {
  it('getHistory sends the entity id as one query value', async () => {
    let received: URL | undefined;
    server.use(
      http.get(`${API_URL}/api/ha/history`, ({ request }) => {
        received = new URL(request.url);
        return HttpResponse.json([[]]);
      }),
    );

    await getHistory('jwt', HOSTILE_ID, 24);

    expect(received?.searchParams.get('entity_id')).toBe(HOSTILE_ID);
    expect(received?.searchParams.getAll('end_time')).toHaveLength(1);
  });

  it('triggerArloSnapshot keeps the entity id inside one path segment', async () => {
    let receivedPath: string | undefined;
    server.use(
      http.post(`${API_URL}/api/arlo/snapshot/:entityId`, ({ request, params }) => {
        receivedPath = new URL(request.url).pathname;
        expect(params.entityId).toBe('camera.a/../b');
        return HttpResponse.json({});
      }),
    );

    await expect(triggerArloSnapshot('jwt', 'camera.a/../b')).resolves.toBe(true);
    expect(receivedPath).toBe('/api/arlo/snapshot/camera.a%2F..%2Fb');
  });

  it('useHABatchHistory sends the ids as one filter value and the start date as one segment', async () => {
    let received: URL | undefined;
    server.use(
      http.get(`${API_URL}/api/ha/history/period/:start`, ({ request }) => {
        received = new URL(request.url);
        return HttpResponse.json([]);
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useHABatchHistory({ entityIds: ['sensor.a', 'sensor.b&x=1'], hours: 24 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(received?.searchParams.get('filter_entity_id')).toBe('sensor.a,sensor.b&x=1');
    expect(received?.searchParams.has('x')).toBe(false);
    expect(received?.pathname).toMatch(/^\/api\/ha\/history\/period\/\d{4}-\d\d-\d\dT[^/]+$/);
  });
});
