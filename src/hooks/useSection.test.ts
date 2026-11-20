import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSection } from './useSection';

const goTo = (hash: string) => {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

describe('useSection', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('starts on the section named by the hash', () => {
    window.location.hash = '#energie';
    const { result } = renderHook(() => useSection());
    expect(result.current.section).toBe('energie');
  });

  it('starts on the home overview without a hash', () => {
    const { result } = renderHook(() => useSection());
    expect(result.current.section).toBe('accueil');
  });

  it('follows the hash and scrolls back to the top', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const { result } = renderHook(() => useSection());

    act(() => goTo('#securite'));
    expect(result.current.section).toBe('securite');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    act(() => goTo('#inconnu'));
    expect(result.current.section).toBe('accueil');
  });

  it('names the widgets a link asks to unfold, and leaves the scroll to the dashboard', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const { result } = renderHook(() => useSection());

    act(() => goTo('#maison/lights'));
    expect(result.current).toEqual({ section: 'maison', focus: ['lights'] });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useSection());
    unmount();
    expect(remove).toHaveBeenCalledWith('hashchange', expect.any(Function));
  });
});
