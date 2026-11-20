/**
 * useOptimisticFeed — Manages the pending-feedings buffer used for optimistic
 * UI while a manual feed is propagating through the PetKit vendor API.
 *
 * Why a local buffer instead of writing into the React Query cache: the real
 * record lands on a subsequent vendor sync (not as a response to the feed
 * POST), and it arrives with a server-generated id + slightly different time.
 * We keep the optimistic entry local and "absorb" it when a matching real
 * record (same amounts, within a 5-min window) shows up — which lets us roll
 * back cleanly on failure without touching the cache.
 */
import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  triggerPetkitFeed,
  type PetKitData,
  type PetkitDevice,
  type PetkitRecord,
} from '../../services/api';
import { logger } from '../../lib/logger';
import { useNow } from '../useNow';
import { notifyActionFailure } from '../../lib/action-feedback';

interface Args {
  device: Pick<PetkitDevice, 'id' | 'deviceType'> | undefined;
  token: string | null | undefined;
  data: PetKitData | null;
}

const OPTIMISTIC_ENTRY_LIFETIME_MS = 10 * 60 * 1000;

/** Whether the real record of an optimistic feed is in the data (±5 min, same amounts). */
const isAbsorbed = (pending: PetkitRecord, records: PetkitRecord[] | undefined) =>
  !!records?.some(
    (real) =>
      (real.type === 4 || real.type === 5) &&
      Math.abs(real.time - pending.time) < 300 &&
      real.amount1 === pending.amount1 &&
      real.amount2 === pending.amount2,
  );

/**
 * Manual feeding with an optimistic entry in the timeline.
 *
 * @param args - Feeder, session token and Petkit data (to spot the real record).
 * @returns The optimistic entries, whether a feed is in progress, and the feed action.
 */
export function useOptimisticFeed({ device, token, data }: Args) {
  const [optimisticFeedings, setOptimisticFeedings] = useState<PetkitRecord[]>([]);
  const [isFeeding, setIsFeeding] = useState(false);

  const now = useNow();
  // An optimistic entry is absorbed once the real record shows up (±5 min, same amounts), and
  // expires after 10 minutes: by then the real record is in the data, and on a dashboard left open
  // for days it must not come back once that record leaves the back's rolling window.
  const records = data?.records;
  const pendingFeedings = useMemo(
    () =>
      optimisticFeedings.filter(
        (pending) =>
          pending.time * 1000 > now - OPTIMISTIC_ENTRY_LIFETIME_MS && !isAbsorbed(pending, records),
      ),
    [optimisticFeedings, records, now],
  );

  const handleFeed = useCallback(async () => {
    if (!device || !token) return;
    setIsFeeding(true);
    const now = Math.floor(Date.now() / 1000);

    const optimisticRecord: PetkitRecord = {
      id: `opt_${now}_${Math.random().toString(36).substring(7)}`,
      deviceId: device.id,
      deviceType: device.deviceType,
      day: parseInt(format(new Date(), 'yyyyMMdd')),
      content: 'Distribution manuelle (Optimiste)',
      amount1: 1,
      amount2: 1,
      time: now,
      type: 4,
      state: { realAmount1: 1, realAmount2: 1 },
    };

    try {
      // Entries already absorbed are dropped here, so the list never grows.
      setOptimisticFeedings((prev) => [
        optimisticRecord,
        ...prev.filter((pending) => !isAbsorbed(pending, records)),
      ]);
      // Throws on any failure (ApiError or network), handled below.
      await triggerPetkitFeed(token, device.id, 1, 1);
    } catch (e) {
      logger.error('Failed to feed:', e);
      setOptimisticFeedings((prev) => prev.filter((r) => r.id !== optimisticRecord.id));
      notifyActionFailure(e, 'le distributeur');
    } finally {
      setIsFeeding(false);
    }
  }, [device, token, records]);

  return { pendingFeedings, isFeeding, handleFeed };
}
