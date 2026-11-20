/**
 * app-update — Keeps the installed PWA on the latest deployed version: asks the browser to look
 * for a new service worker regularly and whenever the app comes back to the screen, and reloads
 * into the new version at a moment that does not interrupt the user.
 */

/** How often an open app looks for a new version. */
export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Without any interaction for this long, a waiting new version is loaded. */
export const IDLE_RELOAD_MS = 30 * 1000;

const USER_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

interface WatchOptions {
  /** The service worker registration, whose `update()` fetches `sw.js` again. */
  registration: Pick<ServiceWorkerRegistration, 'update'>;
  /** Reloads the page into the new version. */
  reload: () => void;
  /** Document and window to listen on (injected for the tests). */
  doc?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  win?: Pick<
    Window,
    | 'addEventListener'
    | 'removeEventListener'
    | 'setInterval'
    | 'clearInterval'
    | 'setTimeout'
    | 'clearTimeout'
  >;
}

/** Handle returned by {@link watchForAppUpdates}. */
export interface AppUpdateWatcher {
  /**
   * A new version took control: reload now if the app is hidden, else at the next return to
   * the screen or after {@link IDLE_RELOAD_MS} without interaction, whichever comes first.
   */
  newVersionReady: () => void;
  /** Stops every timer and listener. */
  stop: () => void;
}

/**
 * Looks for a new version every {@link UPDATE_CHECK_INTERVAL_MS} while visible and on every
 * return to the screen; reloads into it without interrupting the user.
 *
 * @param options - Registration, reload function and, for the tests, document and window.
 * @returns The watcher: call `newVersionReady` when the new service worker takes control.
 */
export function watchForAppUpdates({
  registration,
  reload,
  doc = document,
  win = window,
}: WatchOptions): AppUpdateWatcher {
  let reloadPending = false;
  let reloaded = false;
  let idleTimer: number | undefined;

  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    reload();
  };

  const check = () => {
    // Offline or server unreachable: the next check will try again.
    registration.update().catch(() => undefined);
  };

  const restartIdleTimer = () => {
    if (idleTimer !== undefined) win.clearTimeout(idleTimer);
    idleTimer = win.setTimeout(reloadOnce, IDLE_RELOAD_MS);
  };

  const onVisibility = () => {
    if (doc.visibilityState !== 'visible') {
      // Leaving the screen is the best moment: nobody is looking.
      if (reloadPending) reloadOnce();
      return;
    }
    if (reloadPending) reloadOnce();
    else check();
  };

  const interval = win.setInterval(() => {
    if (doc.visibilityState === 'visible') check();
  }, UPDATE_CHECK_INTERVAL_MS);
  doc.addEventListener('visibilitychange', onVisibility);

  const stop = () => {
    win.clearInterval(interval);
    if (idleTimer !== undefined) win.clearTimeout(idleTimer);
    doc.removeEventListener('visibilitychange', onVisibility);
    for (const event of USER_ACTIVITY_EVENTS) win.removeEventListener(event, restartIdleTimer);
  };

  return {
    newVersionReady: () => {
      if (doc.visibilityState !== 'visible') {
        reloadOnce();
        return;
      }
      // WARNING: the new worker already dropped the old build's precache, and lazily loaded
      // chunks of the old build may be gone from the server: keep this wait short.
      reloadPending = true;
      for (const event of USER_ACTIVITY_EVENTS) win.addEventListener(event, restartIdleTimer);
      restartIdleTimer();
    },
    stop,
  };
}
