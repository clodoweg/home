/** useResponsive tests — viewport dimensions, breakpoints and resize tracking. */
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResponsive } from './useResponsive';

const initialWidth = window.innerWidth;
const initialHeight = window.innerHeight;

/** Sets the jsdom viewport size without firing any event. */
function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  });
}

afterEach(() => {
  setViewport(initialWidth, initialHeight);
});

describe('useResponsive', () => {
  it.each([
    [320, true, true],
    [349, true, true],
    [350, false, true],
    [767, false, true],
    [768, false, false],
    [1440, false, false],
  ])('at %i px wide: isSmall=%s, isMobile=%s', (width, isSmall, isMobile) => {
    setViewport(width, 900);

    const { result } = renderHook(() => useResponsive());

    expect(result.current).toEqual({ width, height: 900, isSmall, isMobile });
  });

  it('follows window resizes', () => {
    setViewport(1024, 768);
    const { result } = renderHook(() => useResponsive());

    act(() => {
      setViewport(375, 812);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toEqual({ width: 375, height: 812, isSmall: false, isMobile: true });
  });

  it('stops listening once unmounted', () => {
    setViewport(1024, 768);
    const { result, unmount } = renderHook(() => useResponsive());

    unmount();
    setViewport(300, 500);
    window.dispatchEvent(new Event('resize'));

    expect(result.current.width).toBe(1024);
  });

  it('falls back to 1024 x 768 when there is no window (server render)', () => {
    /** Prints the dimensions the hook sees on first render. */
    function Probe() {
      const { width, height, isMobile } = useResponsive();
      return createElement('span', null, `${width}x${height}:${isMobile}`);
    }
    vi.stubGlobal('window', undefined);
    let html: string;
    try {
      html = renderToString(createElement(Probe));
    } finally {
      vi.unstubAllGlobals();
    }

    expect(html).toBe('<span>1024x768:false</span>');
  });
});
