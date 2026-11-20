/**
 * User & Preferences API
 * Profile lookups and persistence of widget layout / theme / notification preferences.
 * Shapes mirror the back's `widgetPreferencesSchema` (home-back lib/validators.ts).
 */
import type { UserGroup } from '../utils/permissions';
import { request } from './request';

export interface TemperatureThresholds {
  tempIndoorMinRed: number;
  tempIndoorMinOrange: number;
  tempIndoorMaxOrange: number;
  tempIndoorMaxRed: number;
  tempOutdoorMinRed: number;
  tempOutdoorMinOrange: number;
  tempOutdoorMaxOrange: number;
  tempOutdoorMaxRed: number;
}

export interface HumidityThresholds {
  humIndoorMinRed: number;
  humIndoorMinOrange: number;
  humIndoorMaxOrange: number;
  humIndoorMaxRed: number;
  humOutdoorMinRed: number;
  humOutdoorMinOrange: number;
  humOutdoorMaxOrange: number;
  humOutdoorMaxRed: number;
}

/** Thresholds of the Telegram alerts (admin only, sent by the back). */
export interface NotificationThresholds {
  notificationSpaTempThreshold: number;
  notificationHumidityThreshold: number;
  notificationTempMinThreshold: number;
  notificationTempMaxThreshold: number;
  notificationHumidityMinThreshold: number;
  notificationHumidityMaxThreshold: number;
}

/** Layout and alert preferences stored on the back (`User.widgetPreferences`). */
export interface WidgetPreferences extends Partial<NotificationThresholds> {
  widgetOrder?: string[];
  roomOrder?: string[];
  floorOrder?: string[];
  roomIcons?: Record<string, string>;
  hiddenWidgets?: string[];
  hiddenRooms?: string[];
  hiddenSensors?: string[];
  collapsed?: Record<string, boolean>;
  tempThresholds?: Partial<TemperatureThresholds>;
  humThresholds?: Partial<HumidityThresholds>;
}

export interface UserProfile {
  email: string;
  group: UserGroup;
  permissions: string[];
  widgetPreferences: WidgetPreferences | null;
  theme: 'light' | 'dark';
}

/**
 * Retrieves the authenticated user's profile and group permissions.
 *
 * @param token - Session token.
 * @param signal - Cancellation (profile timeout).
 * @returns The profile.
 */
export const getUserProfile = (token: string, signal?: AbortSignal): Promise<UserProfile> =>
  request<UserProfile>(token, '/api/user/me', { signal, name: 'getUserProfile' });

export interface NotificationPreferences {
  alarm?: boolean;
  lights?: boolean;
  spa?: boolean;
  fountain?: boolean;
  feeder?: boolean;
  motion?: boolean;
  washingMachine?: boolean;
  printer?: boolean;
  temperature?: boolean;
  humidity?: boolean;
}

export interface NotificationSettings {
  telegramChatId: string | null;
  notificationPreferences: NotificationPreferences;
}

/** Body of GET /api/user/preferences (its `preferences` field also comes with the profile). */
interface PreferencesResponse {
  telegramChatId?: string | null;
  notificationPreferences?: NotificationPreferences | null;
}

/**
 * Fetches the user's Telegram chat ID and per-category notification toggles.
 *
 * @param token - Session token.
 * @param signal - Cancellation from React Query.
 * @returns The settings, with empty defaults.
 */
export const getNotificationSettings = async (
  token: string,
  signal?: AbortSignal,
): Promise<NotificationSettings> => {
  const data = await request<PreferencesResponse>(token, '/api/user/preferences', {
    signal,
    name: 'getNotificationSettings',
  });
  return {
    telegramChatId: data.telegramChatId ?? null,
    notificationPreferences: data.notificationPreferences ?? {},
  };
};

/** Fields accepted by POST /api/user/preferences (merged into the stored preferences). */
export type PreferencesUpdate = WidgetPreferences & {
  theme?: 'light' | 'dark';
  telegramChatId?: string | null;
  notificationPreferences?: NotificationPreferences;
};

/**
 * Saves preferences; only the given fields change on the back.
 *
 * @param token - Session token.
 * @param update - Fields to change.
 * @returns Resolves once saved; rejects (ApiError) otherwise.
 */
export const updatePreferences = (token: string, update: PreferencesUpdate): Promise<void> =>
  request<void>(token, '/api/user/preferences', {
    method: 'POST',
    body: update,
    responseType: 'none',
    name: 'updatePreferences',
  });

/**
 * Saves a specific widget preference or the entire layout.
 *
 * @param token - Session token.
 * @param update - Fields to change.
 * @returns true once saved; rejects (ApiError) otherwise.
 */
export const saveWidgetPreference = (token: string, update: PreferencesUpdate): Promise<boolean> =>
  updatePreferences(token, update).then(() => true);
