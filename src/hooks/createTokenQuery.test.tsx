/** createTokenQuery tests — token gating, enabled flag, cache defaults and caller overrides. */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { createTokenQuery } from './createTokenQuery';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

beforeEach(() => {
  profile.token = 'jwt';
});

describe('createTokenQuery', () => {
  it('passes the active token and the query signal to the fetcher and exposes its result', async () => {
    const fetcher = vi.fn(async (token: string) => ({ token }));
    const useThing = createTokenQuery(['thing', 'a'], fetcher);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useThing(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetcher).toHaveBeenCalledWith('jwt', expect.any(AbortSignal));
    expect(result.current.data).toEqual({ token: 'jwt' });
  });

  it('applies a 30 min staleTime and a 1 h gcTime by default', async () => {
    const useThing = createTokenQuery(['thing', 'b'], async () => 1);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useThing(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client.getQueryCache().find({ queryKey: ['thing', 'b'] });
    expect(query?.observers[0].options.staleTime).toBe(30 * 60 * 1000);
    expect(query?.gcTime).toBe(60 * 60 * 1000);
  });

  it('lets the caller defaults override the built-in cache options', async () => {
    const useThing = createTokenQuery(['thing', 'c'], async () => 1, { staleTime: 5 });
    const client = createTestQueryClient();

    const { result } = renderHook(() => useThing(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client.getQueryCache().find({ queryKey: ['thing', 'c'] });
    expect(query?.observers[0].options.staleTime).toBe(5);
  });

  it('does not fetch without a token', () => {
    profile.token = null;
    const fetcher = vi.fn(async () => 1);
    const useThing = createTokenQuery(['thing', 'd'], fetcher);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useThing(), { wrapper: createQueryWrapper(client) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not fetch when the caller disables it, even with a token', () => {
    const fetcher = vi.fn(async () => 1);
    const useThing = createTokenQuery(['thing', 'e'], fetcher);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useThing(false), { wrapper: createQueryWrapper(client) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('resolves to null without calling the fetcher when refetched manually without a token', async () => {
    profile.token = null;
    const fetcher = vi.fn(async () => 1);
    const useThing = createTokenQuery(['thing', 'f'], fetcher);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useThing(), { wrapper: createQueryWrapper(client) });
    const refetched = await result.current.refetch();

    expect(refetched.status).toBe('success');
    expect(refetched.data).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
