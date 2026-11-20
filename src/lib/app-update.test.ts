/** app-update.test — Regular update checks and a reload that does not interrupt the user. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IDLE_RELOAD_MS, UPDATE_CHECK_INTERVAL_MS, watchForAppUpdates } from './app-update';

/** A document whose visibility the test drives. */
const makeDoc = () => {
  const target = new EventTarget();
  const doc = Object.assign(target, { visibilityState: 'visible' as DocumentVisibilityState });
  const show = (state: DocumentVisibilityState) => {
    doc.visibilityState = state;
    doc.dispatchEvent(new Event('visibilitychange'));
  };
  return { doc: doc as unknown as Document, show };
};

describe('watchForAppUpdates', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const reload = vi.fn();
    const { doc, show } = makeDoc();
    const watcher = watchForAppUpdates({ registration: { update }, reload, doc, win: window });
    return { update, reload, show, watcher };
  };

  it('looks for a new version regularly while the app is on screen', () => {
    const { update, show, watcher } = setup();
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(update).toHaveBeenCalledTimes(1);

    show('hidden');
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(update).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it('looks for a new version whenever the app comes back to the screen', () => {
    const { update, show, watcher } = setup();
    show('hidden');
    show('visible');
    expect(update).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it('survives a failed check (offline)', async () => {
    const { update, show, watcher } = setup();
    update.mockRejectedValueOnce(new Error('offline'));
    show('visible');
    await vi.runOnlyPendingTimersAsync();
    expect(update).toHaveBeenCalled();
    watcher.stop();
  });

  it('reloads at once when the new version arrives while the app is hidden', () => {
    const { reload, show, watcher } = setup();
    show('hidden');
    watcher.newVersionReady();
    expect(reload).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it('on screen, waits for the user to stop interacting before reloading', () => {
    const { reload, watcher } = setup();
    watcher.newVersionReady();
    vi.advanceTimersByTime(IDLE_RELOAD_MS - 1000);
    window.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(IDLE_RELOAD_MS - 1000);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it('on screen, reloads when the user leaves or comes back, only once', () => {
    const { reload, show, watcher } = setup();
    watcher.newVersionReady();
    show('hidden');
    show('visible');
    vi.advanceTimersByTime(IDLE_RELOAD_MS);
    expect(reload).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it('reloads on the next return to the screen', () => {
    const { reload, show, watcher } = setup();
    watcher.newVersionReady();
    show('visible');
    expect(reload).toHaveBeenCalledTimes(1);
    watcher.stop();
  });
});
