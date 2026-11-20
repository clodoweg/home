/** Hourly readings — resamples a Home Assistant history to one value per hour. */
import type { HistoryPoint } from '../services/api';

const HOUR_MS = 3_600_000;

/**
 * One reading per hour over the last `hours` hours: the value in force at each hour mark (a Home
 * Assistant state holds until the next change), then the current value. A sensor reporting every
 * few minutes or only twice a day gives the same regular curve. Hours before the first known
 * reading are left out, and unavailable states do not count as readings.
 *
 * @param points - History of one sensor, in time order (`last_changed` as ISO dates).
 * @param nowMs - End of the window, in milliseconds since the epoch.
 * @param hours - Length of the window, in hours (24 by default).
 * @returns Up to `hours + 1` numbers, oldest first; empty without any numeric reading.
 */
export function hourlyReadings(
  points: readonly HistoryPoint[] | undefined,
  nowMs: number,
  hours = 24,
): number[] {
  const readings = (points ?? [])
    .map((point) => ({ at: Date.parse(point.last_changed), value: parseFloat(point.state) }))
    .filter(({ at, value }) => Number.isFinite(at) && Number.isFinite(value));
  if (readings.length === 0) return [];

  const values: number[] = [];
  let next = 0;
  let current: number | undefined;
  for (let hour = hours; hour >= 0; hour--) {
    const mark = nowMs - hour * HOUR_MS;
    while (next < readings.length && readings[next].at <= mark) current = readings[next++].value;
    if (current !== undefined) values.push(current);
  }
  // A reading time-stamped a little after `now` (clock skew) still ends the curve.
  if (next < readings.length) values[values.length - 1] = readings[readings.length - 1].value;
  return values;
}
