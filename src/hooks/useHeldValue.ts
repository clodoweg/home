/** useHeldValue — A value chosen by the user, kept for a while before the device's own value takes over again. */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Holds a value for `durationMs` after each change. Home Assistant reports a new setpoint only
 * some seconds after the command: showing the held value meanwhile keeps a slider from jumping
 * back to the old setpoint.
 *
 * @param durationMs - How long a value is held.
 * @returns The held value (null when nothing is held) and the function to hold a new one.
 */
export function useHeldValue<T>(durationMs: number) {
  const [held, setHeld] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const hold = useCallback(
    (value: T) => {
      setHeld(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHeld(null), durationMs);
    },
    [durationMs],
  );

  return [held, hold] as const;
}
