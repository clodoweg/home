/**
 * useMasonryRows — Masonry layout for a CSS grid: each child spans as many thin rows as its
 * height, so the grid's own placement drops the next child under the shortest column.
 */
import { useLayoutEffect, type RefObject } from 'react';

/** Height of one grid row, in px: must match the container's `auto-rows` value. */
const MASONRY_ROW_PX = 4;

/**
 * Number of rows a child of the given height spans, its gap included.
 *
 * @param height - Child height, in px.
 * @param gap - Space kept under the child, in px.
 * @returns The row span, at least 1.
 */
export const masonryRowSpan = (height: number, gap: number): number =>
  Math.max(1, Math.ceil((height + gap) / MASONRY_ROW_PX));

/**
 * Lays the container's children out as a masonry while the media query matches: the container
 * must then be a grid with `MASONRY_ROW_PX` rows, no row gap and children aligned to the start
 * (a stretched child would grow with its span, and its span with its height). The column gap is
 * reused as the vertical gap. Outside the query, the children get back their normal rows.
 *
 * @param containerRef - The grid container.
 * @param mediaQuery - When the masonry applies, e.g. `(min-width: 1280px)`.
 */
export function useMasonryRows(containerRef: RefObject<HTMLElement | null>, mediaQuery: string) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(mediaQuery);

    const layout = () => {
      const children = Array.from(container.children) as HTMLElement[];
      if (!media.matches) {
        children.forEach((child) => child.style.removeProperty('grid-row-end'));
        return;
      }
      const gap = Number.parseFloat(getComputedStyle(container).columnGap) || 0;
      children.forEach((child) => {
        child.style.gridRowEnd = `span ${masonryRowSpan(child.getBoundingClientRect().height, gap)}`;
      });
    };

    // A tile changes height as its data arrives (Petkit, forecasts, pictures): re-measure then.
    const resizeObserver = new ResizeObserver(layout);
    const observeChildren = () => {
      resizeObserver.disconnect();
      Array.from(container.children).forEach((child) => resizeObserver.observe(child));
      layout();
    };
    const mutationObserver = new MutationObserver(observeChildren);
    mutationObserver.observe(container, { childList: true });
    media.addEventListener('change', layout);
    observeChildren();

    return () => {
      media.removeEventListener('change', layout);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [containerRef, mediaQuery]);
}
