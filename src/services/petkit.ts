/**
 * PetKit API
 * Device state and event records of the feeders and fountains, and manual feeding.
 */
import { request } from './request';

/** One meal of a feeder schedule. */
export interface FeedScheduleItem {
  amount1?: number;
  amount2?: number;
  time?: number;
  name?: string;
}

/** Feeder schedule; `repeats` is a bit mask of weekdays (bit 0 Monday … bit 6 Sunday, 127 = every day). */
export interface FeedSchedule {
  items?: FeedScheduleItem[];
  repeats: number;
  suspended?: number | boolean;
}

/** Device object as Petkit sends it; only the fountain fields read by the app are typed. */
export interface PetkitRawDevice {
  status?: {
    pim?: number;
    water_level_status?: number;
    mode?: number;
    battery?: number;
    electricQuantity?: number;
  };
  [field: string]: unknown;
}

export interface PetkitDevice {
  id: number;
  deviceId: number;
  deviceType: string;
  feedSchedule?: FeedSchedule[];
  sn: string;
  name: string;
  status: {
    battery?: number;
    batteryStatus?: number;
    pim?: number; // Filter percentage (Fountain)
    food1?: number;
    food2?: number;
    feedSchedule?: FeedSchedule[];
  };
  data?: PetkitRawDevice;
  dailyFeed?: {
    realAmountTotal1: number;
    realAmountTotal2: number;
    planAmountTotal1: number;
    planAmountTotal2: number;
    eatCount: number;
    eatAvg: number;
  };
}

/** Portions actually given by a feed event (they can differ from the requested ones). */
export interface FeedRecordState {
  realAmount1?: number;
  realAmount2?: number;
  [field: string]: unknown;
}

export interface PetkitRecord {
  id?: string;
  eventId?: string;
  deviceId: number;
  deviceType: string;
  day: number;
  content: string;
  desc?: string;
  amount?: number;
  amount1?: number;
  amount2?: number;
  time: number;
  type: number; // 1=move, 2=visit, 3=eat, 4/5=feed
  state?: FeedRecordState | number;
  imgs?: string[];
  preview?: string;
  aesKey?: string;
  preview1?: string;
  aesKey1?: string;
  preview2?: string;
  aesKey2?: string;
}

/** One visit of the pet at the fountain; times in seconds (`dayTime` since midnight). */
export interface FountainWorkRecord {
  dayTime?: number;
  time?: number;
  timestamp?: number;
  stayTime?: number;
  duration?: number;
  dur?: number;
  amount?: number;
}

/** Daily summary of a fountain. */
export interface FountainDayData {
  filterPercent?: number;
  lackWarning?: boolean | number;
  mode?: number;
  electricity?: { batteryPercent?: number };
  status?: { electricStatus?: number };
  activity?: { morning?: number; afternoon?: number; night?: number };
}

export interface FountainDay {
  deviceId: number;
  day: string;
  data?: FountainDayData;
  workRecords?: FountainWorkRecord[];
}

export interface PetKitData {
  devices: PetkitDevice[];
  records: PetkitRecord[];
  fountains?: FountainDay[];
  lastSyncedAt?: string;
}

/**
 * Retrieves PetKit device data and recent event records.
 *
 * @param token - Session token.
 * @param days - Number of days of records.
 * @param signal - Cancellation from React Query.
 * @returns Devices, records and fountain data.
 */
export const getPetkitData = (
  token: string,
  days: number = 1,
  signal?: AbortSignal,
): Promise<PetKitData | null> =>
  request<PetKitData | null>(token, '/api/petkit', {
    query: { days },
    signal,
    name: 'getPetkitData',
  });

/**
 * Triggers a manual feeding action on a PetKit feeder.
 *
 * @param token - Session token.
 * @param deviceId - Feeder id.
 * @param amount1 - Portions from bowl 1.
 * @param amount2 - Portions from bowl 2.
 * @returns The back's message; rejects (ApiError) when the feed failed.
 */
export const triggerPetkitFeed = async (
  token: string,
  deviceId: string | number,
  amount1: number,
  amount2: number,
): Promise<{ success: true; message?: string }> => {
  // The back answers `{ message }` on success, without a `success` field.
  const { message } = await request<{ message?: string }>(token, '/api/petkit/feed', {
    method: 'POST',
    body: { deviceId, amount1, amount2 },
    name: `triggerPetkitFeed (Device: ${deviceId})`,
  });
  return { success: true, message };
};
