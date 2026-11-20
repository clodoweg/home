/**
 * useFeederDailyTotals — Computes daily feeding totals for Today and Yesterday.
 *
 * Encapsulates calculation of consumed rations and scheduled totals for both
 * Today and Yesterday, supporting fallback aggregates when historical events
 * are limited.
 */
import { useMemo } from 'react';
import { startOfDay, subDays } from 'date-fns';
import type { FeedSchedule, PetKitData, PetkitDevice, PetkitRecord } from '../../services/api';
import { useNow } from '../useNow';
import {
  isFeedEvent,
  mergeRecords,
  plannedRations,
  recordsOfDay,
  totalRations,
} from './feeder-records';

export interface DailyTotals {
  todayTotalRations: number;
  todayPlanTotal: number;
  yesterdayTotalRations: number;
  yesterdayPlanTotal: number;
  todayColorClass: string;
}

/** Device fields read here, all optional: a device may lack any of them. */
interface FeederTotalsDevice {
  dailyFeed?: Partial<NonNullable<PetkitDevice['dailyFeed']>>;
  status?: { feedSchedule?: FeedSchedule[] };
  feedSchedule?: FeedSchedule[];
}

interface Args {
  data: PetKitData | null;
  device: FeederTotalsDevice | undefined;
  pendingFeedings: PetkitRecord[];
}

/**
 * Computes feeder ration totals for today and yesterday. The days follow the clock, so a PWA
 * left open past midnight moves on to the new day.
 *
 * @param args - Device data and pending feedings.
 * @returns Totals and plan totals for today and yesterday.
 */
export function useFeederDailyTotals({ data, device, pendingFeedings }: Args): DailyTotals {
  const now = useNow();
  const todayStart = startOfDay(now).getTime();

  const { today, yesterday } = useMemo(() => {
    const feedEvents = mergeRecords(pendingFeedings, data?.records ?? []).filter(isFeedEvent);
    const todayDate = new Date(todayStart);
    return {
      today: recordsOfDay(feedEvents, todayDate, now),
      yesterday: recordsOfDay(feedEvents, subDays(todayDate, 1), now),
    };
  }, [data?.records, pendingFeedings, todayStart, now]);

  // Without per-event history (no 'history' right), the device's own daily totals stand in.
  const consumedToday =
    today.length > 0
      ? totalRations(today)
      : (device?.dailyFeed?.realAmountTotal1 || 0) + (device?.dailyFeed?.realAmountTotal2 || 0);

  const feedSchedule = device?.status?.feedSchedule || device?.feedSchedule;
  const todayPlanTotal = plannedRations(feedSchedule, new Date(todayStart));
  const yesterdayPlanTotal = plannedRations(feedSchedule, subDays(new Date(todayStart), 1));

  const todayColorClass =
    consumedToday >= todayPlanTotal && todayPlanTotal > 0
      ? 'text-success'
      : consumedToday > 0
        ? 'text-warning'
        : 'text-destructive';

  return {
    todayTotalRations: consumedToday,
    todayPlanTotal,
    yesterdayTotalRations: totalRations(yesterday),
    yesterdayPlanTotal,
    todayColorClass,
  };
}
