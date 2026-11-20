/** usePetkitData tests — 7-day PetKit fetch, token gating and the 2 min polling switch. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PETKIT_DATA } from '../../e2e/fixtures/mock-data/petkit-data';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { usePetkitData } from './usePetkitData';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

let requests: URL[] = [];

beforeEach(() => {
  profile.token = 'jwt';
  requests = [];
  server.use(
    http.get(`${API_URL}/api/petkit`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(PETKIT_DATA);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePetkitData', () => {
  it('fetches seven days of PetKit data under the ["petkit","data"] key', async () => {
    const client = createTestQueryClient();

    const { result } = renderHook(() => usePetkitData(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PETKIT_DATA);
    expect(requests[0].searchParams.get('days')).toBe('7');
    expect(client.getQueryData(['petkit', 'data'])).toEqual(PETKIT_DATA);
    const options = client.getQueryCache().find({ queryKey: ['petkit', 'data'] })
      ?.observers[0].options;
    expect(options?.refetchOnWindowFocus).toBe(false);
    expect(options?.staleTime).toBe(120_000);
  });

  it('does not fetch without a token', () => {
    profile.token = null;
    const client = createTestQueryClient();

    const { result } = renderHook(() => usePetkitData(), { wrapper: createQueryWrapper(client) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(requests).toHaveLength(0);
  });

  it('surfaces a backend error', async () => {
    server.use(
      http.get(`${API_URL}/api/petkit`, () =>
        HttpResponse.json({ error: 'vendor down' }, { status: 503 }),
      ),
    );
    const client = createTestQueryClient();

    const { result } = renderHook(() => usePetkitData(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Error 503: vendor down');
  });

  it('polls every 2 minutes by default', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = createTestQueryClient();

    renderHook(() => usePetkitData(), { wrapper: createQueryWrapper(client) });
    await waitFor(() => expect(requests).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(120_000);
    await waitFor(() => expect(requests).toHaveLength(2));
  });

  it('does not poll when autoRefresh is off', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = createTestQueryClient();

    renderHook(() => usePetkitData(false), { wrapper: createQueryWrapper(client) });
    await waitFor(() => expect(requests).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(360_000);
    expect(requests).toHaveLength(1);
  });
});
