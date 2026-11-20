/** query-wrapper — Fresh React Query client and provider wrapper for hook, context and component tests. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

/**
 * Creates an isolated QueryClient: no retry, so a failing request settles at once.
 *
 * @returns A new QueryClient that no other test shares.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/**
 * Builds a `renderHook` wrapper that provides the given client.
 *
 * @param client - The QueryClient the hooks under test read and write.
 * @returns A wrapper component for `renderHook`.
 */
export function createQueryWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
