/** useFeederDayRecords tests — merge and dedup of records, day filter, category counts and timeline filters. */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PetKitData, PetkitRecord } from '../../services/api';
import { useFeederDayRecords } from './useFeederDayRecords';

const NOW = new Date('2026-10-23T12:00:00+02:00');
const TODAY = new Date('2026-10-23T00:00:00+02:00');

/** Unix seconds for a Paris wall-clock time on 2026-10-23. */
const at = (time: string) => Math.floor(new Date(`2026-10-23T${time}:00+02:00`).getTime() / 1000);

const RECORDS = [
  { type: 1, deviceId: 1, time: at('08:00'), id: 'move' },
  { type: 2, deviceId: 1, time: at('08:30'), id: 'visit' },
  { type: 3, deviceId: 1, time: at('09:00'), id: 'eat' },
  { type: 4, deviceId: 1, time: at('10:00'), id: 'feed' },
  { type: 5, deviceId: 1, time: at('11:00'), eventId: 'manual' },
  { type: 6, deviceId: 1, time: at('11:30'), id: 'other' },
  { type: 4, deviceId: 1, time: at('18:00'), id: 'future' },
  { type: 4, deviceId: 1, time: at('10:00') - 86_400, id: 'yesterday' },
];

const data = { devices: [], records: RECORDS } as unknown as PetKitData;

type Filter = Parameters<typeof useFeederDayRecords>[0]['timelineFilter'];

/** Renders the hook over the fixture records for the given filter. */
function renderDay(timelineFilter: Filter, pendingFeedings: unknown[] = []) {
  return renderHook(() =>
    useFeederDayRecords({
      data,
      pendingFeedings: pendingFeedings as PetkitRecord[],
      selectedDate: TODAY,
      timelineFilter,
    }),
  );
}

const ids = (records: { id?: string; eventId?: string }[]) => records.map((r) => r.id ?? r.eventId);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFeederDayRecords', () => {
  it('keeps past records of the selected day, newest first', () => {
    const { result } = renderDay('all');

    expect(ids(result.current.recordsForDay)).toEqual([
      'other',
      'manual',
      'feed',
      'eat',
      'visit',
      'move',
    ]);
  });

  it('counts moves, visits, eats and feeds of the day', () => {
    const { result } = renderDay('all');

    expect(result.current.counts).toEqual({ moves: 1, visits: 1, eats: 1, feeds: 2 });
    expect(ids(result.current.feedEventsForDay)).toEqual(['manual', 'feed']);
  });

  it.each([
    ['all', ['manual', 'feed', 'eat', 'visit', 'move']],
    [null, ['manual', 'feed', 'eat', 'visit', 'move']],
    ['activity', ['visit', 'move']],
    ['eat', ['eat']],
    ['feed', ['manual', 'feed']],
    ['unknown', ['other', 'manual', 'feed', 'eat', 'visit', 'move']],
  ])('filter %s keeps %j', (filter, expected) => {
    const { result } = renderDay(filter as Filter);

    expect(ids(result.current.filteredRecords)).toEqual(expected);
  });

  it('merges pending feedings and drops duplicates', () => {
    const pending = [
      { type: 4, deviceId: 1, time: at('10:00'), id: 'feed' },
      { type: 4, deviceId: 1, time: at('11:45'), id: 'opt_1' },
      { type: 4, deviceId: 1, time: at('11:50') },
      { type: 4, deviceId: 1, time: at('11:50') },
    ];

    const { result } = renderDay('feed', pending);

    expect(result.current.filteredRecords.map((r) => r.id ?? r.eventId ?? 'none')).toEqual([
      'none',
      'opt_1',
      'manual',
      'feed',
    ]);
  });

  it('returns empty results without data', () => {
    const { result } = renderHook(() =>
      useFeederDayRecords({
        data: null,
        pendingFeedings: [],
        selectedDate: TODAY,
        timelineFilter: 'all',
      }),
    );

    expect(result.current.recordsForDay).toEqual([]);
    expect(result.current.counts).toEqual({ moves: 0, visits: 0, eats: 0, feeds: 0 });
  });
});
