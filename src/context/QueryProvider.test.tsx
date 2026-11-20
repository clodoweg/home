/** QueryProvider tests — shared client, per-user persisted cache (allowlisted domains only) and restore. */
import { QueryClient, dehydrate, useQueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_BUSTER, QUERY_CACHE_STORAGE_KEY, queryClient } from '../lib/query-client';
import { CACHE_OWNER_KEY } from '../lib/user-data';
import { QueryProvider } from './QueryProvider';

const session = vi.hoisted(() => ({ user: { id: 'user_a' } as { id: string } | null }));

vi.mock('./UserContext', () => ({
  useUserProfile: () => session,
}));

const ClientProbe = () => (
  <span data-testid="client">{useQueryClient() === queryClient ? 'shared' : 'other'}</span>
);

/** Serializes a cache the way the persister writes it. */
const persistedCache = (buster: string, data: unknown) => {
  const source = new QueryClient();
  source.setQueryData(['energy', 'enedis'], data);
  return JSON.stringify({ buster, timestamp: Date.now(), clientState: dehydrate(source) });
};

beforeEach(() => {
  session.user = { id: 'user_a' };
  localStorage.setItem(CACHE_OWNER_KEY, 'user_a');
});

afterEach(() => {
  queryClient.clear();
});

describe('QueryProvider', () => {
  it('provides the shared app client', () => {
    render(
      <QueryProvider>
        <ClientProbe />
      </QueryProvider>,
    );
    expect(screen.getByTestId('client')).toHaveTextContent('shared');
  });

  it('persists allowlisted successful queries under a per-user buster', async () => {
    render(
      <QueryProvider>
        <ClientProbe />
      </QueryProvider>,
    );
    // The provider subscribes to the cache once its (empty) restore has finished.
    await new Promise((resolve) => setTimeout(resolve, 50));

    queryClient.setQueryData(['energy', 'enedis'], { kwh: 12 });
    queryClient.setQueryData(['user', 'profile'], { email: 'a@home' });

    await waitFor(() => expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toBeNull(), {
      timeout: 3000,
    });
    const stored = JSON.parse(localStorage.getItem(QUERY_CACHE_STORAGE_KEY) ?? '{}') as {
      buster: string;
      clientState: { queries: { queryKey: unknown[] }[] };
    };
    expect(stored.buster).toBe(`${CACHE_BUSTER}:user_a`);
    expect(stored.clientState.queries.map((q) => q.queryKey)).toEqual([['energy', 'enedis']]);
  });

  it('restores the cache persisted for the same user', async () => {
    localStorage.setItem(
      QUERY_CACHE_STORAGE_KEY,
      persistedCache(`${CACHE_BUSTER}:user_a`, { kwh: 7 }),
    );

    render(
      <QueryProvider>
        <ClientProbe />
      </QueryProvider>,
    );

    await waitFor(() => expect(queryClient.getQueryData(['energy', 'enedis'])).toEqual({ kwh: 7 }));
  });

  it('discards a cache persisted for another user', async () => {
    localStorage.setItem(
      QUERY_CACHE_STORAGE_KEY,
      persistedCache(`${CACHE_BUSTER}:user_b`, { kwh: 7 }),
    );

    render(
      <QueryProvider>
        <ClientProbe />
      </QueryProvider>,
    );

    await waitFor(() =>
      expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY) ?? '').not.toContain('user_b'),
    );
    expect(queryClient.getQueryData(['energy', 'enedis'])).toBeUndefined();
  });

  it('uses an anonymous buster without a signed-in user', async () => {
    session.user = null;
    localStorage.setItem(
      QUERY_CACHE_STORAGE_KEY,
      persistedCache(`${CACHE_BUSTER}:anonymous`, { kwh: 3 }),
    );

    render(
      <QueryProvider>
        <ClientProbe />
      </QueryProvider>,
    );

    await waitFor(() => expect(queryClient.getQueryData(['energy', 'enedis'])).toEqual({ kwh: 3 }));
  });
});

describe('QueryProvider — Playwright hook', () => {
  it('does not expose the client on window outside test-mode builds', () => {
    expect((window as Window & { queryClient?: unknown }).queryClient).toBeUndefined();
  });

  it('exposes the client on window in a test-mode build', async () => {
    vi.resetModules();
    vi.doMock('../utils/env', async (importOriginal) => ({
      ...(await importOriginal<typeof import('../utils/env')>()),
      isTestMode: true,
    }));
    try {
      await import('./QueryProvider');
      const { queryClient: freshClient } = await import('../lib/query-client');
      expect((window as Window & { queryClient?: unknown }).queryClient).toBe(freshClient);
    } finally {
      vi.doUnmock('../utils/env');
      delete (window as Window & { queryClient?: unknown }).queryClient;
    }
  });
});
