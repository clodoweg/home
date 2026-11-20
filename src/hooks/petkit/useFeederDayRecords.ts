/**
 * useFeederDayRecords — PetKit feeder record pipeline.
 * Merges in-flight optimistic feedings with real records, deduplicates on a
 * composite key (backend sometimes emits the same event in multiple
 * categories), filters to the selected day, and derives per-category counts
 * used by the timeline filters.
 */
import { useMemo } from 'react';
import type { PetKitData, PetkitRecord } from '../../services/api';
import { useNow } from '../useNow';
import { isFeedEvent, mergeRecords, recordsOfDay } from './feeder-records';

export type TimelineFilter = 'all' | 'activity' | 'eat' | 'feed' | null;

interface Args {
  data: PetKitData | null;
  pendingFeedings: PetkitRecord[];
  selectedDate: Date;
  timelineFilter: TimelineFilter;
}

const MATCHES_FILTER: Record<NonNullable<TimelineFilter>, (record: PetkitRecord) => boolean> = {
  all: (record) => record.type >= 1 && record.type <= 5,
  activity: (record) => record.type === 1 || record.type === 2,
  eat: (record) => record.type === 3,
  feed: isFeedEvent,
};

/**
 * Records of the selected day for the feeder timeline.
 *
 * @param args - Petkit data, optimistic feedings, selected day and timeline filter.
 * @returns The day's records, those matching the filter, counts per category and feed events.
 */
export function useFeederDayRecords({ data, pendingFeedings, selectedDate, timelineFilter }: Args) {
  const now = useNow();

  const recordsForDay = useMemo(
    () => recordsOfDay(mergeRecords(pendingFeedings, data?.records ?? []), selectedDate, now),
    [data?.records, pendingFeedings, selectedDate, now],
  );

  const counts = useMemo(
    () => ({
      moves: recordsForDay.filter((r) => r.type === 1).length,
      visits: recordsForDay.filter((r) => r.type === 2).length,
      eats: recordsForDay.filter((r) => r.type === 3).length,
      feeds: recordsForDay.filter(isFeedEvent).length,
    }),
    [recordsForDay],
  );

  const filteredRecords = useMemo(
    () => recordsForDay.filter(MATCHES_FILTER[timelineFilter ?? 'all'] ?? (() => true)),
    [recordsForDay, timelineFilter],
  );

  const feedEventsForDay = useMemo(() => recordsForDay.filter(isFeedEvent), [recordsForDay]);

  return { recordsForDay, filteredRecords, counts, feedEventsForDay };
}
