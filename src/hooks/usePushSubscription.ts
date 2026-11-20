/** usePushSubscription — Whether this browser receives the admin's alerts as push notifications, and the switch. */
import { useCallback, useEffect, useState } from 'react';

import { useUserProfile } from '../context/UserContext';
import { getPushPublicKey, subscribePush, unsubscribePush } from '../services/api';
import { logger } from '../lib/logger';

/** Where push stands on this browser. */
export type PushStatus =
  /** No service worker, no PushManager (old browser, dev server, private window on some). */
  | 'unsupported'
  /** The user blocked notifications for the site: only the browser settings can undo it. */
  | 'denied'
  | 'subscribed'
  | 'unsubscribed';

/**
 * Converts the base64url VAPID key to the bytes PushManager expects.
 *
 * @param base64 - Key as the back gives it.
 * @returns The key bytes.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const isSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const readyRegistration = () =>
  // A pending registration never resolves `ready`: give up after a few seconds.
  Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);

/**
 * State and switch of this browser's push subscription (admins only).
 *
 * @returns The status, whether a change is running, and `enable` / `disable`.
 */
export function usePushSubscription() {
  const { token, isAdmin } = useUserProfile();
  const [status, setStatus] = useState<PushStatus>(() =>
    !isSupported()
      ? 'unsupported'
      : Notification.permission === 'denied'
        ? 'denied'
        : 'unsubscribed',
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin || !isSupported() || Notification.permission === 'denied') return;
    let cancelled = false;
    void readyRegistration().then(async (registration) => {
      if (!registration) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      const existing = await registration.pushManager.getSubscription();
      if (!cancelled) setStatus(existing ? 'subscribed' : 'unsubscribed');
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const enable = useCallback(async () => {
    if (!token || !isSupported()) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'unsubscribed');
        return;
      }
      const registration = await readyRegistration();
      const key = await getPushPublicKey(token);
      if (!registration || !key) {
        setStatus('unsupported');
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await subscribePush(token, subscription.toJSON());
      setStatus('subscribed');
    } catch (error) {
      logger.warn('[Push] Subscription failed', error);
    } finally {
      setBusy(false);
    }
  }, [token]);

  const disable = useCallback(async () => {
    if (!token || !isSupported()) return;
    setBusy(true);
    try {
      const registration = await readyRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(token, subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus('unsubscribed');
    } catch (error) {
      logger.warn('[Push] Unsubscription failed', error);
    } finally {
      setBusy(false);
    }
  }, [token]);

  return { status, busy, enable, disable };
}
