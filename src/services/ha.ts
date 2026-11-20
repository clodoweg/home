/**
 * Home Assistant API
 * Queries and commands targeting the HA bridge (states, history, service calls,
 * scenes, entity metadata, and camera snapshots).
 */
import { HAState, SceneConfig } from './client';
import { pathSegment, request } from './request';

/**
 * Fetches all scene configurations (brightness) from the backend.
 *
 * @param token - Session token.
 * @param signal - Cancellation from React Query.
 * @returns Brightness configured per scene.
 */
export const getScenes = (token: string, signal?: AbortSignal): Promise<SceneConfig> =>
  request<SceneConfig>(token, '/api/ha/scenes', { signal, name: 'getScenes' });

/**
 * Fetches every Home Assistant state visible to the user.
 *
 * @param token - Session token.
 * @param signal - Cancellation from React Query.
 * @returns The states (camera entities are filtered by the back for some groups).
 */
export const getStates = (token: string, signal?: AbortSignal): Promise<HAState[]> =>
  // Polled every 30 s: a stuck request must not hold the next poll for long.
  request<HAState[]>(token, '/api/ha/states', { signal, timeoutMs: 10_000, name: 'getStates' });

/** Result of a Home Assistant service call. */
export interface ActionResult<T = unknown> {
  success: true;
  data: T;
}

/**
 * Executes a service call (action) in Home Assistant.
 *
 * @param token - Session token.
 * @param domain - HA domain (e.g. `light`).
 * @param service - HA service (e.g. `turn_on`).
 * @param entityId - Target entity id(s).
 * @param serviceData - Service data.
 * @param returnResponse - Whether to wait for and return the HA response.
 * @returns The HA answer; rejects (ApiError) when the back refuses or HA fails.
 */
export const executeAction = (
  token: string,
  domain: string,
  service: string,
  entityId: string | string[],
  serviceData: Record<string, unknown> = {},
  returnResponse: boolean = false,
): Promise<ActionResult> => {
  const target = Array.isArray(entityId) ? `[${entityId.join(', ')}]` : entityId;
  return request<unknown>(token, '/api/ha/call', {
    method: 'POST',
    body: {
      domain,
      service,
      entity_id: entityId,
      service_data: serviceData,
      ...(returnResponse ? { return_response: true } : {}),
    },
    name: `executeAction ${domain}.${service} on ${target}`,
  }).then((data) => ({ success: true as const, data }));
};

/** Area, floor and device model of an entity, from the Home Assistant registries. */
export interface EntityMetadata {
  area: string;
  floor?: string;
  model: string;
}

/**
 * Retrieves area, floor and device model of every light, sensor and climate entity in one call
 * (template fixed on the back, JSON-safe whatever the room names).
 *
 * @param token - Session token.
 * @param signal - Cancellation from React Query.
 * @returns Metadata keyed by entity id (empty strings when unknown).
 */
export const getEntityMetadata = (
  token: string,
  signal?: AbortSignal,
): Promise<Record<string, EntityMetadata>> =>
  request<Record<string, EntityMetadata>>(token, '/api/ha/metadata', {
    signal,
    name: 'getEntityMetadata',
  });

/** One forecast entry of a Home Assistant weather entity. */
export interface WeatherForecast {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
  precipitation_probability?: number;
  wind_speed?: number;
  humidity?: number;
}

/**
 * Retrieves the daily or hourly forecast of a weather entity (read-only route of the back).
 *
 * @param token - Session token.
 * @param entityId - Weather entity id.
 * @param type - Forecast granularity.
 * @param signal - Cancellation from React Query.
 * @returns The forecast entries (empty when HA has none).
 */
export const getWeatherForecast = (
  token: string,
  entityId: string,
  type: 'daily' | 'hourly',
  signal?: AbortSignal,
): Promise<WeatherForecast[]> =>
  request<WeatherForecast[]>(token, '/api/ha/forecast', {
    query: { entity_id: entityId, type },
    signal,
    name: `getWeatherForecast ${entityId} ${type}`,
  });

export interface HistoryPoint {
  state: string;
  last_changed: string;
  attributes?: Record<string, unknown>;
}

/**
 * Rounds the given date down to the nearest 5-minute bucket.
 * Stabilizes history URLs so React Query / backend caches can reuse responses
 * across rapid successive calls within the same 5-minute window.
 *
 * @param d - Date to round (mutated).
 * @returns The same date, rounded.
 */
const roundTo5Min = (d: Date): Date => {
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - (d.getMinutes() % 5));
  return d;
};

/** Start and end of a history window ending now (rounded to 5 minutes). */
const historyWindow = (hoursBack: number) => {
  const end = roundTo5Min(new Date());
  return { start: new Date(end.getTime() - hoursBack * 60 * 60 * 1000), end };
};

/** One history point as returned by Home Assistant. */
interface RawHistoryPoint {
  entity_id?: string;
  state: string;
  last_changed: string;
  attributes?: Record<string, unknown>;
}

/**
 * Retrieves historical states for a specific entity.
 *
 * @param token - Session token.
 * @param entityId - Entity to read.
 * @param hoursBack - Window length, ending now.
 * @param signal - Cancellation from React Query.
 * @returns The points of the window (empty when HA has none).
 */
export const getHistory = async (
  token: string,
  entityId: string,
  hoursBack: number = 24,
  signal?: AbortSignal,
): Promise<HistoryPoint[]> => {
  const { start, end } = historyWindow(hoursBack);
  const data = await request<RawHistoryPoint[][]>(token, '/api/ha/history', {
    query: { entity_id: entityId, start_time: start.toISOString(), end_time: end.toISOString() },
    signal,
    name: `getHistory ${entityId}`,
  });
  return (data?.[0] ?? []).map((point) => ({
    state: point.state,
    last_changed: point.last_changed,
    attributes: point.attributes,
  }));
};

/**
 * Retrieves the history of several entities in one call.
 *
 * @param token - Session token.
 * @param entityIds - Entities to read.
 * @param hoursBack - Window length, ending now.
 * @param signal - Cancellation from React Query.
 * @returns Points keyed by entity id (entities without history are absent).
 */
export const getHistoryBatch = async (
  token: string,
  entityIds: string[],
  hoursBack: number,
  signal?: AbortSignal,
): Promise<Record<string, HistoryPoint[]>> => {
  const { start, end } = historyWindow(hoursBack);
  const data = await request<RawHistoryPoint[][]>(
    token,
    `/api/ha/history/period/${pathSegment(start.toISOString())}`,
    {
      query: { filter_entity_id: entityIds.join(','), end_time: end.toISOString() },
      signal,
      name: `getHistoryBatch [${entityIds.slice(0, 3).join(', ')}${entityIds.length > 3 ? '...' : ''}]`,
    },
  );
  const result: Record<string, HistoryPoint[]> = {};
  if (!Array.isArray(data)) return result;
  for (const series of data) {
    const entityId = Array.isArray(series) ? series[0]?.entity_id : undefined;
    if (!entityId) continue;
    result[entityId] = series.map((point) => ({
      state: point.state,
      last_changed: point.last_changed,
    }));
  }
  return result;
};

/**
 * Triggers a camera snapshot (optimized for Arlo via backend proxy).
 *
 * @param token - Session token.
 * @param entityId - Camera entity id.
 * @returns true once the back accepted the request; rejects otherwise.
 */
export const triggerArloSnapshot = (token: string, entityId: string): Promise<boolean> =>
  request<unknown>(token, `/api/arlo/snapshot/${pathSegment(entityId)}`, {
    method: 'POST',
    name: `triggerSnapshot ${entityId}`,
  }).then(() => true);

export { roundTo5Min };
