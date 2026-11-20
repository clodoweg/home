/**
 * local-store — localStorage wrapper that never throws, for the app's own persisted state.
 *
 * Clerk React manages its own session storage (cookies + localStorage), so no
 * `tokenCache` prop is passed to `<ClerkProvider>`. This module only serves the
 * app's own persisted state (cached profile).
 *
 * WARNING: localStorage is not encrypted. Never store a token here. Values persisted
 * via this module (profile cache) are recoverable by anyone with access to the device,
 * and are wiped at logout (see lib/user-data).
 */
import { logger } from '../lib/logger';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const localStore = {
  isAvailableAsync: async (): Promise<boolean> => isBrowser,

  getItemAsync: async (key: string): Promise<string | null> => {
    if (!isBrowser) return null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      logger.error('localStore get item error:', error);
      return null;
    }
  },

  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      logger.error('localStore set item error:', error);
    }
  },

  deleteItemAsync: async (key: string): Promise<void> => {
    if (!isBrowser) return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      logger.error('localStore delete item error:', error);
    }
  },
};
