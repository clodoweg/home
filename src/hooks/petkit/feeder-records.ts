/** feeder-records — Pure helpers on Petkit records and devices: merging, day filtering, rations and schedules. */
import { isSameDay } from 'date-fns';
import type { FeedSchedule, PetkitDevice, PetkitRecord } from '../../services/api';

/**
 * Whether a record is a food distribution (scheduled or manual).
 *
 * @param record - Petkit record.
 * @returns True for feed events (types 4 and 5).
 */
export const isFeedEvent = (record: PetkitRecord): boolean =>
  record.type === 4 || record.type === 5;

/**
 * Merges the optimistic feedings with the real records, newest first. The back sometimes sends
 * the same event in several categories: duplicates (same type, device, time and id) are dropped.
 *
 * @param pending - Optimistic feedings not confirmed yet.
 * @param records - Records from the back.
 * @returns One list, newest first, without duplicates.
 */
export function mergeRecords(pending: PetkitRecord[], records: PetkitRecord[]): PetkitRecord[] {
  const merged = [...pending, ...records].sort((a, b) => b.time - a.time);
  const seen = new Set<string>();
  return merged.filter((record) => {
    const key = `${record.type}_${record.deviceId}_${record.time}_${record.id || record.eventId || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Records of one day, without those scheduled later today.
 *
 * @param records - Records (time in seconds).
 * @param day - Day to keep.
 * @param now - Current time in ms.
 * @returns The records of that day already past.
 */
export const recordsOfDay = (records: PetkitRecord[], day: Date, now: number): PetkitRecord[] =>
  records.filter(
    (record) => isSameDay(new Date(record.time * 1000), day) && record.time * 1000 <= now,
  );

/**
 * Portions given from one bowl by a feed event: the measured amount when known, else the
 * requested one.
 *
 * @param record - Feed event.
 * @param bowl - Bowl number.
 * @returns The portions.
 */
function realAmount(record: PetkitRecord, bowl: 1 | 2): number {
  const measured =
    typeof record.state === 'object'
      ? bowl === 1
        ? record.state.realAmount1
        : record.state.realAmount2
      : undefined;
  return measured ?? (bowl === 1 ? record.amount1 : record.amount2) ?? 0;
}

/**
 * Portions given by feed events, from one bowl or both.
 *
 * @param events - Feed events.
 * @param bowl - Bowl number, or both when omitted.
 * @returns The total.
 */
export const totalRations = (events: PetkitRecord[], bowl?: 1 | 2): number =>
  events.reduce(
    (sum, event) =>
      sum + (bowl ? realAmount(event, bowl) : realAmount(event, 1) + realAmount(event, 2)),
    0,
  );

/**
 * Portions planned on a day by the active feeder schedule.
 *
 * @param schedules - Feeder schedules; `repeats` is a weekday bit mask (bit 0 Monday … bit 6
 *   Sunday, 127 every day), as the back sends it.
 * @param date - Day.
 * @returns The planned portions (0 without an active schedule for that day).
 */
export function plannedRations(schedules: FeedSchedule[] | undefined, date: Date): number {
  const weekdayBit = 1 << (date.getDay() === 0 ? 6 : date.getDay() - 1);
  const schedule = schedules?.find((s) => !s.suspended && (s.repeats & weekdayBit) !== 0);
  return (
    schedule?.items?.reduce((sum, item) => sum + (item.amount1 || 0) + (item.amount2 || 0), 0) || 0
  );
}

/**
 * First device whose type contains one of the keywords (case-insensitive).
 *
 * @param devices - Petkit devices.
 * @param keywords - Lower-case type fragments, e.g. `['d4', 'feeder']`.
 * @returns The device, if any.
 */
export const findPetkitDevice = (
  devices: PetkitDevice[] | undefined,
  keywords: string[],
): PetkitDevice | undefined =>
  devices?.find((device) => {
    const type = device.deviceType.toLowerCase();
    return keywords.some((keyword) => type.includes(keyword));
  });
