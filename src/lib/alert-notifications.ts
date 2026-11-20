/**
 * alert-notifications — What the app and its service worker share about the admin's alerts:
 * the widget each alert category opens, and how a push payload is read.
 */
import { widgetHref } from '../constants/sections';
import type { NotificationCategory } from '../services/notifications';

/** Message the service worker posts to the open app when a push arrives. */
export const PUSH_RECEIVED_MESSAGE = 'hsh-push-received';

/** Widget an alert is about, opened (unfolded alone) when the alert is clicked. */
const CATEGORY_WIDGET: Record<NotificationCategory, string> = {
  alarm: 'alarm',
  motion: 'arlo',
  lights: 'lights',
  temperature: 'temperature',
  humidity: 'temperature',
  spa: 'spa',
  fountain: 'fountain',
  feeder: 'feeder',
  washingMachine: 'washing_machine',
  printer: 'bambu_lab',
};

/**
 * Link an alert opens: its widget, alone unfolded in its section; the home screen for an
 * unknown category.
 *
 * @param category - Alert category from the back.
 * @returns The hash link, e.g. `#securite/alarm`.
 */
export function alertHref(category: string): string {
  const widget = CATEGORY_WIDGET[category as NotificationCategory];
  return widget ? widgetHref(widget) : '#';
}

/** A push notification as the back sends it. */
export interface AlertPush {
  id: number | null;
  title: string;
  body: string;
  category: string;
}

/**
 * Reads a push payload defensively: a malformed or empty one still gives a notification.
 *
 * @param payload - Parsed JSON of the push, or anything else.
 * @returns Title, body, category and id.
 */
export function parseAlertPush(payload: unknown): AlertPush {
  const data = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  return {
    id: typeof data.id === 'number' ? data.id : null,
    title: typeof data.title === 'string' && data.title ? data.title : 'Home',
    body: typeof data.body === 'string' ? data.body : '',
    category: typeof data.category === 'string' ? data.category : '',
  };
}
