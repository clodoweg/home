/** useGasData tests — GRDF request window (3 years back to today) and token gating. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRDF_DATA } from '../../e2e/fixtures/mock-data/grdf-data';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { useGasData } from './useGasData';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

beforeEach(() => {
  profile.token = 'jwt';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-15T12:00:00+01:00'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useGasData', () => {
  it('asks for the last 3 × 365 days', async () => {
    let received: URL | undefined;
    server.use(
      http.get(`${API_URL}/api/grdf`, ({ request }) => {
        received = new URL(request.url);
        return HttpResponse.json(GRDF_DATA);
      }),
    );
    const client = createTestQueryClient();

    const { result } = renderHook(() => useGasData(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Object.fromEntries(received?.searchParams ?? [])).toEqual({
      start: '2023-03-16',
      end: '2026-03-15',
    });
    expect(client.getQueryData(['energy', 'gas'])).toEqual(GRDF_DATA);
  });

  it('does not fetch without a token or when disabled', async () => {
    const requested = vi.fn();
    server.use(http.get(`${API_URL}/api/grdf`, requested));
    const client = createTestQueryClient();

    renderHook(() => useGasData(false), { wrapper: createQueryWrapper(client) });
    profile.token = null;
    const anonymous = renderHook(() => useGasData(), { wrapper: createQueryWrapper(client) });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(requested).not.toHaveBeenCalled();
    expect(anonymous.result.current.fetchStatus).toBe('idle');
  });

  it('exposes a backend failure as a query error', async () => {
    server.use(http.get(`${API_URL}/api/grdf`, () => new HttpResponse('down', { status: 503 })));
    const client = createTestQueryClient();

    const { result } = renderHook(() => useGasData(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Error 503: down');
  });
});
