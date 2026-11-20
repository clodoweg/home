/** useDayNavigation — Selected day of a widget with day-by-day history, never past today. */
import { useCallback, useMemo, useState } from 'react';
import { startOfDay, subDays } from 'date-fns';
import { useNow } from './useNow';

/**
 * Day selection starting today. The selection is kept as a number of days before today, so a
 * PWA left open past midnight moves on with the clock ("today" stays today).
 *
 * @returns The selected day (midnight) and the functions to move one day back or forward.
 */
export function useDayNavigation() {
  const now = useNow();
  const [daysBack, setDaysBack] = useState(0);
  const today = startOfDay(now).getTime();
  const selectedDate = useMemo(() => subDays(new Date(today), daysBack), [today, daysBack]);
  const goToPreviousDay = useCallback(() => setDaysBack((days) => days + 1), []);
  const goToNextDay = useCallback(() => setDaysBack((days) => Math.max(0, days - 1)), []);
  return { selectedDate, goToPreviousDay, goToNextDay };
}
