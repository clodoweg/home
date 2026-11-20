/** useFountainDay — State of a Petkit fountain and the pet's visits on a given day. */
import { useMemo } from 'react';
import { format } from 'date-fns';
import type { FountainWorkRecord, PetKitData, PetkitDevice } from '../../services/api';

/** Most recent visits listed in the timeline. */
const MAX_LISTED_VISITS = 50;

/**
 * Hour of a visit, from whichever time field the record carries: seconds since midnight, or a
 * Unix timestamp in seconds.
 *
 * @param record - Fountain visit.
 * @returns The hour, or -1 when the record has no usable time.
 */
export function visitHour(record: FountainWorkRecord): number {
  const rawTime = record.dayTime ?? record.time ?? record.timestamp;
  if (typeof rawTime !== 'number') return -1;
  return rawTime > 86400 ? new Date(rawTime * 1000).getHours() : Math.floor(rawTime / 3600);
}

/**
 * Fountain state and visits of the selected day.
 *
 * @param data - Petkit data.
 * @param device - Fountain device.
 * @param selectedDate - Day shown.
 * @returns Filter life, water level (0 normal), mode, power, visits per period and the visit list.
 */
export function useFountainDay(
  data: PetKitData | null,
  device: PetkitDevice | undefined,
  selectedDate: Date,
) {
  return useMemo(() => {
    const day = format(selectedDate, 'yyyy-MM-dd');
    const record = device
      ? data?.fountains?.find(
          (f) => f?.day && String(f.deviceId) === String(device.id) && f.day.split('T')[0] === day,
        )
      : undefined;
    const status = device?.status ?? {};
    const raw = device?.data?.status ?? {};
    const visits = record?.workRecords ?? [];

    let activity;
    if (visits.length === 0) {
      // Without the visit list, the daily summary still gives the counts per period.
      const morning = record?.data?.activity?.morning || 0;
      const afternoon = record?.data?.activity?.afternoon || 0;
      const night = record?.data?.activity?.night || 0;
      activity = { morning, afternoon, night, total: morning + afternoon + night };
    } else {
      activity = { morning: 0, afternoon: 0, night: 0, total: visits.length };
      for (const visit of visits) {
        const hour = visitHour(visit);
        if (hour >= 6 && hour < 12) activity.morning++;
        else if (hour >= 12 && hour < 18) activity.afternoon++;
        else if (hour !== -1) activity.night++;
      }
    }

    return {
      filterLife: record?.data?.filterPercent ?? status.pim ?? raw.pim ?? 0,
      waterLevelStatus: raw.water_level_status ?? (record?.data?.lackWarning ? 1 : 0),
      mode: raw.mode ?? record?.data?.mode ?? 1,
      battery: status.battery ?? raw.battery ?? record?.data?.electricity?.batteryPercent,
      isPlugged: raw.electricQuantity !== 0 || record?.data?.status?.electricStatus === 2,
      activity,
      totalDrunkMinutes: Math.round(visits.reduce((sum, v) => sum + (v.stayTime || 0), 0) / 60),
      latestVisits: [...visits]
        .sort((a, b) => (b.dayTime || 0) - (a.dayTime || 0))
        .slice(0, MAX_LISTED_VISITS),
    };
  }, [data?.fountains, device, selectedDate]);
}
