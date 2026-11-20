/**
 * PetKit Data Fetching Hook
 * Monitors feeder and fountain statuses with scheduled background polling.
 */
import { useQuery } from '@tanstack/react-query';
import { getPetkitData, PetKitData } from '../services/api';
import { useUserProfile } from '../context/UserContext';
import { queryKeys } from '../lib/query-keys';

/**
 * Hook to fetch PetKit device statuses (feeders, fountains).
 * Implements automated background polling (2 min interval).
 *
 * @param autoRefresh - Whether to enable background polling. Query stays enabled
 *   either way so cached data is always available; only the interval is gated.
 */
export function usePetkitData(autoRefresh: boolean = true) {
  const { token } = useUserProfile();
  return useQuery<PetKitData | null>({
    queryKey: queryKeys.petkit.data,
    queryFn: ({ signal }) => getPetkitData(token!, 7, signal),
    enabled: !!token,
    refetchInterval: autoRefresh ? 120_000 : false,
    refetchIntervalInBackground: false,
    // Refetch au focus orchestré par DashboardScreen (différé après ha-states)
    // pour éviter la contention réseau au retour en premier plan.
    refetchOnWindowFocus: false,
    staleTime: 120_000,
  });
}
