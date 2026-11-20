/** useWeatherForecast — Daily or hourly forecast of a weather entity, with the attribute as fallback. */
import { useQuery } from '@tanstack/react-query';
import { getWeatherForecast, type HAState, type WeatherForecast } from '../services/api';
import { useUserProfile } from '../context/UserContext';
import { queryKeys } from '../lib/query-keys';

/**
 * Loads a forecast of a weather entity. When the back cannot answer (HA down), the daily
 * forecast still carried by some integrations in the entity's `forecast` attribute is used
 * instead (it is daily: it cannot stand in for the hourly one).
 *
 * @param entity - Weather entity.
 * @param type - Forecast granularity.
 * @param enabled - Whether the forecast is shown (default true).
 * @returns React Query result with the forecast entries.
 */
export function useWeatherForecast(entity: HAState, type: 'daily' | 'hourly', enabled = true) {
  const { token } = useUserProfile();
  return useQuery<WeatherForecast[]>({
    queryKey: queryKeys.ha.forecast(entity.entity_id, type),
    queryFn: async ({ signal }) => {
      try {
        return await getWeatherForecast(token!, entity.entity_id, type, signal);
      } catch (error) {
        if (type !== 'daily' || signal.aborted) throw error;
        const fallback = entity.attributes.forecast as WeatherForecast[] | undefined;
        if (fallback?.length) return fallback;
        throw error;
      }
    },
    enabled: !!token && enabled,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
