/**
 * history/series — Conversion des statistiques HA et des compteurs d'usage en séries
 * journalières, et calculs dérivés (confort par heure, regroupement par pièce).
 */
import type { HumidityThresholds, TemperatureThresholds } from '../../services/user';
import type { StatisticRow, UsageResponse } from '../../services/history';
import { humidityComfort, temperatureComfort, type ComfortLevel } from '../comfort';
import { dayKey, type DayValue } from './period';

type RowValue = 'mean' | 'min' | 'max' | 'change';

/**
 * Rows of a statistic gathered per local day: a mean of means, the lowest min, the highest max,
 * the sum of changes. Rows longer than a day (months) keep their first day.
 *
 * @param rows - Rows of one statistic.
 * @param value - Value to read.
 * @returns One value per day, in chronological order.
 */
export function statisticDays(
  rows: readonly StatisticRow[] | undefined,
  value: RowValue,
): DayValue[] {
  const days = new Map<string, number[]>();
  for (const row of rows ?? []) {
    const v = row[value];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const key = dayKey(new Date(row.start));
    const list = days.get(key) ?? [];
    list.push(v);
    days.set(key, list);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      value:
        value === 'min'
          ? Math.min(...values)
          : value === 'max'
            ? Math.max(...values)
            : value === 'change'
              ? values.reduce((a, b) => a + b, 0)
              : values.reduce((a, b) => a + b, 0) / values.length,
    }));
}

/**
 * Sum, day by day, of every usage metric of a kind (`light_hours`, `motion`…), whatever the
 * entity after the colon.
 *
 * @param usage - Usage series of the back.
 * @param kind - Metric kind, e.g. `washer_cycles` or `motion`.
 * @param keep - Filter on the entity of `<kind>:<entity>` metrics.
 * @returns One value per day, in chronological order.
 */
export function usageDays(
  usage: UsageResponse | undefined,
  kind: string,
  keep: (entity: string) => boolean = () => true,
): DayValue[] {
  const totals = new Map<string, number>();
  for (const [metric, series] of Object.entries(usage ?? {})) {
    const [metricKind, entity = ''] = metric.split(/:(.*)/s);
    if (metricKind !== kind || (entity && !keep(entity))) continue;
    for (const { date, value } of series) totals.set(date, (totals.get(date) ?? 0) + value);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

/**
 * Entities of `<kind>:<entity>` metrics present in the usage.
 *
 * @param usage - Usage series of the back.
 * @param kind - Metric kind.
 * @returns The entity ids, sorted.
 */
export function usageEntities(usage: UsageResponse | undefined, kind: string): string[] {
  return Object.keys(usage ?? {})
    .filter((metric) => metric.startsWith(`${kind}:`))
    .map((metric) => metric.slice(kind.length + 1))
    .sort();
}

/** Hours spent at each comfort level. */
export type ComfortHours = Record<Exclude<ComfortLevel, 'unknown'>, number>;

/**
 * Hours a room spent in, near and out of its comfort zone, from its hourly means.
 *
 * @param rows - Hourly rows of the sensor (`mean`).
 * @param kind - Temperature or humidity.
 * @param floor - Floor of the sensor (outdoor thresholds outside).
 * @param thresholds - The user's thresholds.
 * @returns Hours per level.
 */
export function comfortHours(
  rows: readonly StatisticRow[] | undefined,
  kind: 'temperature' | 'humidity',
  floor: string | undefined,
  thresholds: { temp: TemperatureThresholds; hum: HumidityThresholds },
): ComfortHours {
  const hours: ComfortHours = { ok: 0, warning: 0, alert: 0 };
  for (const row of rows ?? []) {
    if (typeof row.mean !== 'number') continue;
    const level =
      kind === 'temperature'
        ? temperatureComfort(row.mean, floor, thresholds.temp)
        : humidityComfort(row.mean, floor, thresholds.hum);
    if (level !== 'unknown') hours[level] += 1;
  }
  return hours;
}

/**
 * Light hours per room: the usage of each light, summed by the room HA gives it.
 *
 * @param usage - Usage series of the back.
 * @param areaOf - Room of a light entity (`Autres` when unknown).
 * @param isRoomHidden - Rooms the user hid (left out, as everywhere).
 * @param from - First day (`yyyy-MM-dd`).
 * @param to - Last day (`yyyy-MM-dd`), included.
 * @returns Rooms sorted by hours, most lit first.
 */
export function lightHoursByRoom(
  usage: UsageResponse | undefined,
  areaOf: (entityId: string) => string,
  isRoomHidden: (room: string) => boolean,
  from: string,
  to: string,
): { room: string; hours: number }[] {
  const rooms = new Map<string, number>();
  for (const entity of usageEntities(usage, 'light_hours')) {
    const room = areaOf(entity);
    if (isRoomHidden(room)) continue;
    const hours = (usage?.[`light_hours:${entity}`] ?? [])
      .filter((d) => d.date >= from && d.date <= to)
      .reduce((sum, d) => sum + d.value, 0);
    rooms.set(room, (rooms.get(room) ?? 0) + hours);
  }
  return [...rooms.entries()]
    .map(([room, hours]) => ({ room, hours }))
    .sort((a, b) => b.hours - a.hours || a.room.localeCompare(b.room));
}
