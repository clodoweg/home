/**
 * createTokenQuery — Factory for token-gated React Query hooks.
 * Eliminates the boilerplate `useQuery` wrapper that every data hook was
 * duplicating: read token from UserContext, guard against null, return null
 * when unauthenticated. Consolidates caching defaults in one place.
 */
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useUserProfile } from '../context/UserContext';

type QueryOptions<T> = Omit<UseQueryOptions<T | null>, 'queryKey' | 'queryFn' | 'enabled'>;

/**
 * Builds a token-aware query hook. The returned hook accepts an `enabled` flag
 * that combines with token presence to decide whether to fire the request.
 *
 * @param queryKey - Stable React Query key for the resource.
 * @param fetcher - Async function that receives the active token and React Query's signal.
 * @param defaults - Cache/polling defaults applied to every caller.
 * @returns A hook `(enabled?: boolean) => UseQueryResult<T | null>`.
 */
export function createTokenQuery<T>(
  queryKey: readonly unknown[],
  fetcher: (token: string, signal: AbortSignal) => Promise<T | null>,
  defaults?: QueryOptions<T>,
) {
  return function useTokenQuery(enabled: boolean = true) {
    const { token } = useUserProfile();
    return useQuery<T | null>({
      queryKey,
      queryFn: ({ signal }) => (token ? fetcher(token, signal) : Promise.resolve(null)),
      enabled: !!token && enabled,
      staleTime: 30 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      ...defaults,
    });
  };
}
