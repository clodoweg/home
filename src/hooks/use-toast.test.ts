/** use-toast tests — global toast store: limit, update, dismiss, delayed removal and reducer. */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ToastModule = typeof import('./use-toast');

let toastModule: ToastModule;

beforeEach(async () => {
  // The store lives at module level: a fresh module per test keeps tests independent.
  vi.resetModules();
  toastModule = await import('./use-toast');
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toast and useToast', () => {
  it('adds an open toast with an incrementing id and notifies mounted hooks', () => {
    const { result } = renderHook(() => toastModule.useToast());

    let handle: ReturnType<ToastModule['toast']> | undefined;
    act(() => {
      handle = toastModule.toast({ title: 'Saved', variant: 'default' });
    });

    expect(handle?.id).toBe('1');
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({ id: '1', title: 'Saved', open: true });
  });

  it('keeps only the most recent toast (limit of 1)', () => {
    const { result } = renderHook(() => toastModule.useToast());

    act(() => {
      result.current.toast({ title: 'First' });
      result.current.toast({ title: 'Second' });
    });

    expect(result.current.toasts.map((t) => t.title)).toEqual(['Second']);
  });

  it('update merges new props into the matching toast only', () => {
    const { result } = renderHook(() => toastModule.useToast());
    let handle: ReturnType<ToastModule['toast']> | undefined;
    act(() => {
      handle = toastModule.toast({ title: 'Uploading' });
    });

    act(() => handle?.update({ id: 'ignored', title: 'Done', variant: 'destructive' }));

    expect(result.current.toasts[0]).toMatchObject({
      id: handle?.id,
      title: 'Done',
      variant: 'destructive',
      open: true,
    });
  });

  it('dismiss closes the toast and removes it after the removal delay', () => {
    const { result } = renderHook(() => toastModule.useToast());
    let handle: ReturnType<ToastModule['toast']> | undefined;
    act(() => {
      handle = toastModule.toast({ title: 'Bye' });
    });

    act(() => handle?.dismiss());
    expect(result.current.toasts[0].open).toBe(false);

    act(() => vi.advanceTimersByTime(999));
    expect(result.current.toasts).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('closes a toast on its own after 5 s, then removes it', () => {
    const { result } = renderHook(() => toastModule.useToast());
    act(() => {
      toastModule.toast({ title: 'Action impossible' });
    });

    act(() => vi.advanceTimersByTime(4_999));
    expect(result.current.toasts[0].open).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toasts[0].open).toBe(false);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('dismissing twice schedules a single removal', () => {
    const { result } = renderHook(() => toastModule.useToast());
    let handle: ReturnType<ToastModule['toast']> | undefined;
    act(() => {
      handle = toastModule.toast({ title: 'Twice' });
    });

    act(() => {
      handle?.dismiss();
      handle?.dismiss();
    });

    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.runAllTimers());
    expect(result.current.toasts).toHaveLength(0);
  });

  it('dismiss without id closes every toast', () => {
    const { result } = renderHook(() => toastModule.useToast());
    act(() => {
      toastModule.toast({ title: 'A' });
    });

    act(() => result.current.dismiss());

    expect(result.current.toasts.every((t) => t.open === false)).toBe(true);
    act(() => vi.runAllTimers());
    expect(result.current.toasts).toHaveLength(0);
  });

  it('onOpenChange(false) dismisses the toast, onOpenChange(true) does nothing', () => {
    const { result } = renderHook(() => toastModule.useToast());
    act(() => {
      toastModule.toast({ title: 'Closable' });
    });

    act(() => result.current.toasts[0].onOpenChange?.(true));
    expect(result.current.toasts[0].open).toBe(true);

    act(() => result.current.toasts[0].onOpenChange?.(false));
    expect(result.current.toasts[0].open).toBe(false);
  });

  it('stops notifying a hook once unmounted', () => {
    const { result, unmount } = renderHook(() => toastModule.useToast());
    unmount();

    act(() => {
      toastModule.toast({ title: 'Unseen' });
    });

    expect(result.current.toasts).toHaveLength(0);
    const { result: fresh } = renderHook(() => toastModule.useToast());
    expect(fresh.current.toasts.map((t) => t.title)).toEqual(['Unseen']);
  });
});

describe('reducer', () => {
  const base = {
    toasts: [
      { id: 'a', title: 'A', open: true },
      { id: 'b', title: 'B', open: true },
    ],
  };

  it('REMOVE_TOAST with an id removes that toast only', () => {
    expect(toastModule.reducer(base, { type: 'REMOVE_TOAST', toastId: 'a' }).toasts).toEqual([
      base.toasts[1],
    ]);
  });

  it('REMOVE_TOAST without id empties the list', () => {
    expect(toastModule.reducer(base, { type: 'REMOVE_TOAST' }).toasts).toEqual([]);
  });

  it('DISMISS_TOAST with an id closes that toast only', () => {
    const next = toastModule.reducer(base, { type: 'DISMISS_TOAST', toastId: 'b' });
    expect(next.toasts.map((t) => t.open)).toEqual([true, false]);
  });

  it('UPDATE_TOAST leaves other toasts untouched', () => {
    const next = toastModule.reducer(base, {
      type: 'UPDATE_TOAST',
      toast: { id: 'a', title: 'A2' },
    });
    expect(next.toasts[0].title).toBe('A2');
    expect(next.toasts[1]).toBe(base.toasts[1]);
  });
});
