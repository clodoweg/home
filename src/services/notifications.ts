/** notifications — The admin's alerts for the bell and the Web Push subscription of this browser. */
import { request } from './request';

/** Alert categories the back sends (same as its alert engine). */
export type NotificationCategory =
  | 'alarm'
  | 'lights'
  | 'spa'
  | 'fountain'
  | 'feeder'
  | 'humidity'
  | 'motion'
  | 'temperature'
  | 'washingMachine'
  | 'printer';

/** One alert as the bell lists it. */
export interface AppNotification {
  id: number;
  category: NotificationCategory;
  title: string;
  /** Plain text, possibly several lines. */
  body: string;
  /** ISO date. */
  createdAt: string;
  read: boolean;
}

/** The bell's content: latest alerts (newest first) and how many are unread. */
export interface NotificationList {
  notifications: AppNotification[];
  unread: number;
}

/**
 * Latest alerts of the signed-in admin.
 *
 * @param token - Session token.
 * @param signal - Cancellation.
 * @returns The list and the unread count.
 */
export const getNotifications = (token: string, signal?: AbortSignal): Promise<NotificationList> =>
  request<NotificationList>(token, '/api/notifications', { signal, name: 'getNotifications' });

/**
 * Marks alerts as read.
 *
 * @param token - Session token.
 * @param ids - Alerts to mark; every unread one when omitted.
 * @returns Resolves once saved.
 */
export const markNotificationsRead = (token: string, ids?: number[]): Promise<void> =>
  request<void>(token, '/api/notifications/read', {
    method: 'POST',
    body: ids ? { ids } : {},
    responseType: 'none',
    name: 'markNotificationsRead',
  });

/**
 * Public key the browser subscribes to Web Push with.
 *
 * @param token - Session token.
 * @returns The key, or null when the back has no push configured.
 */
export const getPushPublicKey = async (token: string): Promise<string | null> =>
  (
    await request<{ publicKey: string | null }>(token, '/api/push/public-key', {
      name: 'getPushPublicKey',
    })
  ).publicKey;

/**
 * Registers this browser's push subscription for the admin's alerts.
 *
 * @param token - Session token.
 * @param subscription - `PushSubscription.toJSON()`.
 * @returns Resolves once saved.
 */
export const subscribePush = (token: string, subscription: PushSubscriptionJSON): Promise<void> =>
  request<void>(token, '/api/push/subscription', {
    method: 'POST',
    body: subscription,
    responseType: 'none',
    name: 'subscribePush',
  });

/**
 * Forgets this browser's push subscription.
 *
 * @param token - Session token.
 * @param endpoint - The subscription's endpoint.
 * @returns Resolves once done.
 */
export const unsubscribePush = (token: string, endpoint: string): Promise<void> =>
  request<void>(token, '/api/push/unsubscribe', {
    method: 'POST',
    body: { endpoint },
    responseType: 'none',
    name: 'unsubscribePush',
  });
