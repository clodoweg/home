/** useElementWidth — Width of an element, kept up to date with a ResizeObserver (chart sizing). */
import { useCallback, useRef, useState } from 'react';

/**
 * Measures an element's width as soon as it is attached, and on every resize.
 *
 * @param inset - Horizontal space to subtract (e.g. the padding around a chart).
 * @returns A callback ref to put on the element, and its width (0 until measured).
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(inset = 0) {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node) return;
      const report = () => setWidth(Math.max(0, node.getBoundingClientRect().width - inset));
      report();
      observerRef.current = new ResizeObserver(report);
      observerRef.current.observe(node);
    },
    [inset],
  );

  return [ref, width] as const;
}
