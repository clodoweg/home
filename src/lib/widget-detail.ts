/** widget-detail — Part of a widget a link asked to open (`#maison/temperature/<sensor>`), handed from the dashboard to that widget. */
import { useSyncExternalStore } from 'react';

/** One request: the widget, and the part of it to open (a sensor's entity id…). */
export interface WidgetDetailRequest {
  widgetId: string;
  detail: string;
}

let currentRequest: WidgetDetailRequest | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => currentRequest;

/**
 * Asks a widget to open one of its parts. A new object each time, so the same link followed twice
 * opens the part again after the user closed it.
 *
 * @param widgetId - Widget id (`temperature`).
 * @param detail - Part to open.
 */
export const requestWidgetDetail = (widgetId: string, detail: string): void => {
  currentRequest = { widgetId, detail };
  notify();
};

/**
 * Marks a request as handled, so that a widget mounted later (back to the section) does not open
 * the part again. A newer request is kept.
 *
 * @param request - The request the widget handled.
 */
export const clearWidgetDetail = (request: WidgetDetailRequest): void => {
  if (currentRequest !== request) return;
  currentRequest = null;
  notify();
};

/**
 * Pending request for one widget.
 *
 * @param widgetId - Widget id (`temperature`).
 * @returns The request addressed to this widget, or `null`.
 */
export const useWidgetDetailRequest = (widgetId: string): WidgetDetailRequest | null => {
  const request = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return request?.widgetId === widgetId ? request : null;
};
