/** useEnedisData tests — Enedis request window (daily data since Jan 1st of last year, 15-day load curve) and token gating. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENEDIS_DATA } from '../../e2e/fixtures/mock-data/enedis-data';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { useEnedisData } from './useEnedisData';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

beforeEach(() => {
  profile.token = 'jwt';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-15T00:30:00+01:00'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useEnedisData', () => {
  it('asks for daily data since Jan 1st of last year and 15 days of load curve', async () => {
    let received: URL | undefined;
    let authorization: string | null = null;
    server.use(
      http.get(`${API_URL}/api/enedis/data`, ({ request }) => {
        received = new URL(request.url);
        authorization = request.headers.get('Authorization');
        return HttpResponse.json(ENEDIS_DATA);
      }),
    );
    const client = createTestQueryClient();

    const { result } = renderHook(() => useEnedisData(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Object.fromEntries(received?.searchParams ?? [])).toEqual({
      start: '2025-01-01',
      end: '2026-03-15',
      loadCurveStart: '2026-02-28',
    });
    expect(authorization).toBe('Bearer jwt');
    expect(result.current.data).toEqual(ENEDIS_DATA);
    expect(client.getQueryData(['energy', 'electricity'])).toEqual(ENEDIS_DATA);
  });

  it('does not fetch without a token or when disabled', async () => {
    const requested = vi.fn();
    server.use(http.get(`${API_URL}/api/enedis/data`, requested));
    const client = createTestQueryClient();

    const disabled = renderHook(() => useEnedisData(false), {
      wrapper: createQueryWrapper(client),
    });
    profile.token = null;
    const anonymous = renderHook(() => useEnedisData(), { wrapper: createQueryWrapper(client) });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(requested).not.toHaveBeenCalled();
    expect(disabled.result.current.fetchStatus).toBe('idle');
    expect(anonymous.result.current.data).toBeUndefined();
  });

  it('exposes a backend failure as a query error', async () => {
    server.use(
      http.get(`${API_URL}/api/enedis/data`, () =>
        HttpResponse.json({ error: 'Enedis down', code: 'UPSTREAM' }, { status: 502 }),
      ),
    );
    const client = createTestQueryClient();

    const { result } = renderHook(() => useEnedisData(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Error 502: Enedis down');
  });
});
