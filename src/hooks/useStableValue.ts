/** useStableValue — Keeps the previous reference of a derived value while its content is unchanged. */
import { useState } from 'react';
import { replaceEqualDeep } from '@tanstack/react-query';

/**
 * Returns the previous value when the new one is deeply equal, and reuses unchanged parts
 * otherwise (React Query's structural sharing). A memoized widget fed with it only re-renders
 * when its own entities change, not on every Home Assistant poll.
 *
 * @param value - Freshly derived value (filtered entity list, slice of data).
 * @returns A reference that only changes with the content.
 */
export function useStableValue<T>(value: T): T {
  const [stable, setStable] = useState(value);
  const next = replaceEqualDeep(stable, value);
  // Derived state updated during render (React's documented pattern): no extra effect pass.
  if (next !== stable) setStable(next);
  return next;
}
