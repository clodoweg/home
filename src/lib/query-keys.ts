/**
 * query-keys — Every React Query key of the app, hierarchical by domain, so a whole domain can
 * be refreshed or invalidated with its prefix (e.g. `queryKeys.ha.all` refreshes all HA data).
 */
export const queryKeys = {
  ha: {
    all: ['ha'] as const,
    states: ['ha', 'states'] as const,
    metadata: ['ha', 'metadata'] as const,
    scenes: ['ha', 'scenes'] as const,
    histories: ['ha', 'history'] as const,
    history: (entityId: string, hours: number, attribute = 'state') =>
      ['ha', 'history', entityId, hours, attribute] as const,
    historyBatches: ['ha', 'history-batch'] as const,
    historyBatch: (entityIds: readonly string[], hours: number) =>
      ['ha', 'history-batch', [...entityIds], hours] as const,
    forecasts: ['ha', 'forecast'] as const,
    forecast: (entityId: string, type: 'daily' | 'hourly') =>
      ['ha', 'forecast', entityId, type] as const,
  },
  petkit: {
    all: ['petkit'] as const,
    data: ['petkit', 'data'] as const,
  },
  energy: {
    all: ['energy'] as const,
    electricity: ['energy', 'electricity'] as const,
    gas: ['energy', 'gas'] as const,
    water: ['energy', 'water'] as const,
  },
  /** History tab: long windows, not persisted (too large for localStorage). */
  history: {
    all: ['history'] as const,
    electricity: (start: string, end: string, loadCurveStart: string) =>
      ['history', 'electricity', start, end, loadCurveStart] as const,
    statistics: (
      ids: readonly string[],
      start: string,
      end: string,
      period: string,
      types: readonly string[],
    ) => ['history', 'statistics', [...ids], start, end, period, [...types]] as const,
    usage: (start: string, end: string) => ['history', 'usage', start, end] as const,
  },
  user: {
    notifications: ['user', 'notifications'] as const,
  },
  /** The admin's alerts (bell); not persisted, always fetched fresh. */
  alerts: {
    all: ['alerts'] as const,
    list: ['alerts', 'list'] as const,
  },
};
