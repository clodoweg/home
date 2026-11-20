/**
 * QueryProvider — TanStack Query client setup with localStorage persistence.
 * Single QueryClient instance shared across the app with sensible dashboard defaults.
 *
 * Persistence: au cold-start du PWA, le cache de queries précédent est rehydraté
 * depuis localStorage → le dashboard s'affiche instantanément avec les dernières
 * données connues, puis se rafraîchit en arrière-plan (stale-while-revalidate).
 * Le cache est propre à un utilisateur (buster) et purgé au logout (cf. lib/user-data).
 */
import React from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { cacheBusterFor, persister, queryClient, shouldPersistQuery } from '../lib/query-client';
import { isTestMode } from '../utils/env';
import { useUserProfile } from './UserContext';

// Beyond this age the restored data is dropped. A week: a PWA opened after a few days away paints
// its last known values at once and refreshes them in the background, instead of a spinner
// (asked by the user to cut the waiting time).
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Playwright scripts drive refetches through it; never exposed in a production build.
if (isTestMode && typeof window !== 'undefined') {
  (window as Window & { queryClient?: typeof queryClient }).queryClient = queryClient;
}

/**
 * Wraps children with the shared TanStack Query client + localStorage persistence.
 *
 * @param children - React subtree that needs query access.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUserProfile();
  const userId: string | undefined = user?.id;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: MAX_AGE_MS,
        buster: cacheBusterFor(userId),
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey, query.state.status),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
