/** useNow — Current time for time-window computations, refreshed at a fixed pace. */
import { useEffect, useState } from 'react';

/**
 * Returns the current timestamp and updates it every `intervalMs`, so time windows
 * ("last 24 h", "last 30 days") keep moving while the PWA stays open for days.
 *
 * @param intervalMs - Refresh period in milliseconds (one minute by default).
 * @returns The current time in milliseconds since the epoch.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
