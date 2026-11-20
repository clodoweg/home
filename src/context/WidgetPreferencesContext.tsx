/**
 * WidgetPreferencesContext — Widget order, visibility, thresholds and collapsed state.
 * The stored preferences come with the profile (GET /api/user/me); every change is applied at
 * once, saved to the back (POST /api/user/preferences, partial update) and rolled back if the
 * save fails. Collapsed states are also kept in localStorage for the render before the profile.
 * Folding is for phones only: on a wider screen every widget is unfolded and the saved folding
 * is left as it is, for the phone.
 */
import React, {
  createContext,
  useCallback,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useUserProfile } from './UserContext';
import {
  saveWidgetPreference,
  type HumidityThresholds,
  type NotificationThresholds,
  type TemperatureThresholds,
  type WidgetPreferences,
} from '../services/api';
import { logger } from '../lib/logger';
import { notifySaveFailure } from '../lib/action-feedback';
import { isTestMode } from '../utils/env';
import { useResponsive } from '../hooks/useResponsive';

/** Threshold changes saved together by the thresholds screen. */
export interface ThresholdsUpdate {
  temp?: Partial<TemperatureThresholds>;
  hum?: Partial<HumidityThresholds>;
  notifications?: Partial<NotificationThresholds>;
}

interface WidgetPreferencesContextType extends NotificationThresholds {
  /** Widgets fold only on a phone; on a wider screen they are always unfolded. */
  canFold: boolean;
  isCollapsed: (widgetId: string) => boolean;
  setCollapsed: (widgetId: string, collapsed: boolean) => void;
  /** Unfolds the given widgets and folds the other ones of the list, in one save. */
  unfoldOnly: (widgetIds: readonly string[], unfolded: readonly string[]) => void;
  widgetOrder: string[];
  updateOrder: (newOrder: string[]) => void;
  /** Persisted order of rooms inside the Temperature widget. Empty = alphabetical default. */
  roomOrder: string[];
  updateRoomOrder: (newOrder: string[]) => void;
  /** Persisted order of floors. */
  floorOrder: string[];
  updateFloorOrder: (newOrder: string[]) => void;
  /** IDs of widgets explicitly hidden by the user. */
  hiddenWidgets: string[];
  toggleWidgetVisibility: (id: string) => void;
  isWidgetHidden: (id: string) => boolean;
  /** Room names explicitly hidden inside the Temperature widget. */
  hiddenRooms: string[];
  toggleRoomVisibility: (name: string) => void;
  isRoomHidden: (name: string) => boolean;
  /** Temperature sensor entity IDs explicitly hidden. */
  hiddenSensors: string[];
  toggleSensorVisibility: (entityId: string) => void;
  isSensorHidden: (entityId: string) => boolean;
  tempThresholds: TemperatureThresholds;
  humThresholds: HumidityThresholds;
  /** Saves thresholds; rejects (and restores the previous values) when the save fails. */
  updateThresholds: (update: ThresholdsUpdate) => Promise<void>;
  /** Custom room icon overrides. Key: room name, Value: Lucide icon name. */
  roomIcons: Record<string, string>;
  /** Updates the custom icon for a given room. */
  updateRoomIcon: (room: string, iconName: string) => void;
}

const WidgetPreferencesContext = createContext<WidgetPreferencesContextType | undefined>(undefined);

export const DEFAULT_TEMP_THRESHOLDS: TemperatureThresholds = {
  tempIndoorMinRed: 15,
  tempIndoorMinOrange: 18,
  tempIndoorMaxOrange: 25,
  tempIndoorMaxRed: 30,
  tempOutdoorMinRed: 0,
  tempOutdoorMinOrange: 10,
  tempOutdoorMaxOrange: 28,
  tempOutdoorMaxRed: 32,
};

export const DEFAULT_HUM_THRESHOLDS: HumidityThresholds = {
  humIndoorMinRed: 30,
  humIndoorMinOrange: 40,
  humIndoorMaxOrange: 60,
  humIndoorMaxRed: 70,
  humOutdoorMinRed: 30,
  humOutdoorMinOrange: 40,
  humOutdoorMaxOrange: 60,
  humOutdoorMaxRed: 70,
};

const DEFAULT_NOTIFICATION_THRESHOLDS: NotificationThresholds = {
  notificationSpaTempThreshold: 37,
  notificationHumidityThreshold: 60,
  notificationTempMinThreshold: 15,
  notificationTempMaxThreshold: 30,
  notificationHumidityMinThreshold: 30,
  notificationHumidityMaxThreshold: 70,
};

const DEFAULT_ORDER = [
  'weather',
  'feeder',
  'fountain',
  'lights',
  'temperature',
  'climate',
  'washing_machine',
  'bambu_lab',
  'arlo',
  'alarm',
  'spa',
  'plugs',
  'electricity',
  'gas',
  'water',
];

const COLLAPSED_STORAGE_KEY = 'widget-collapsed-states';

/**
 * Reads collapsed states from localStorage.
 *
 * @returns Record of widget ID to collapsed boolean state.
 */
const readStoredCollapsedStates = (): Record<string, boolean> => {
  try {
    const stored = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return {};
};

const writeStoredCollapsedStates = (collapsed: Record<string, boolean>) => {
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(collapsed));
  } catch (error) {
    logger.error('Failed to save collapsed state to localStorage', error);
  }
};

/**
 * Saved widget order, without widgets removed since (e.g. 'sensors') and with new widgets appended.
 *
 * @param saved - Order stored on the back, if any.
 * @returns The order to display.
 */
const normalizeOrder = (saved: string[] | undefined): string[] => {
  if (!Array.isArray(saved)) return DEFAULT_ORDER;
  const known = saved.filter((w) => DEFAULT_ORDER.includes(w));
  return [...known, ...DEFAULT_ORDER.filter((w) => !known.includes(w))];
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Keeps only the stored fields of the expected shape: preferences saved by older versions of the
 * app were not validated by the back.
 *
 * @param stored - Preferences from the profile.
 * @returns The usable fields.
 */
const sanitizePreferences = (stored: WidgetPreferences): WidgetPreferences => {
  const usable: WidgetPreferences = {};
  for (const key of [
    'widgetOrder',
    'roomOrder',
    'floorOrder',
    'hiddenWidgets',
    'hiddenRooms',
    'hiddenSensors',
  ] as const) {
    if (isStringArray(stored[key])) usable[key] = stored[key];
  }
  if (isPlainObject(stored.roomIcons)) usable.roomIcons = stored.roomIcons;
  if (isPlainObject(stored.collapsed)) usable.collapsed = stored.collapsed;
  if (isPlainObject(stored.tempThresholds)) usable.tempThresholds = stored.tempThresholds;
  if (isPlainObject(stored.humThresholds)) usable.humThresholds = stored.humThresholds;
  for (const key of Object.keys(
    DEFAULT_NOTIFICATION_THRESHOLDS,
  ) as (keyof NotificationThresholds)[]) {
    if (typeof stored[key] === 'number') usable[key] = stored[key];
  }
  return usable;
};

const toggled = (list: string[] | undefined, item: string): string[] => {
  const current = list ?? [];
  return current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
};

/**
 * Provides widget order, visibility, thresholds (saved on the back) and collapsed state
 * (back + localStorage) to the tree.
 *
 * @param children - React subtree that needs widget preference access.
 */
export const WidgetPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const { token, profile } = useUserProfile();
  const canFold = useResponsive().isMobile;
  const canFoldRef = useRef(canFold);
  useEffect(() => {
    canFoldRef.current = canFold;
  });
  const rawPreferences = profile?.widgetPreferences;
  const storedPreferences = useMemo(
    () => (rawPreferences ? sanitizePreferences(rawPreferences) : undefined),
    [rawPreferences],
  );

  const [prefs, setPrefs] = useState<WidgetPreferences>(() => ({
    // The device copy only serves until the account's copy is known.
    collapsed: readStoredCollapsedStates(),
    ...storedPreferences,
  }));
  // Latest state for the save functions, so the payload is computed outside any updater.
  const prefsRef = useRef(prefs);
  const pendingSavesRef = useRef(0);
  // Saves go one after the other: the back rebuilds the stored preferences from its copy of the
  // user, so two partial saves in flight at once would each erase the other's field.
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  // Values the back accepted in this session. A profile fetched before such a save may arrive
  // after it: these values win over its older copy.
  const savedThisSessionRef = useRef<WidgetPreferences>({});
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  });

  // A refreshed profile brings the stored preferences again: adopt them, unless a local change
  // is still being saved (it would be overwritten by an older copy).
  useEffect(() => {
    if (!storedPreferences || pendingSavesRef.current > 0) return;
    prefsRef.current = {
      ...prefsRef.current,
      ...storedPreferences,
      ...savedThisSessionRef.current,
    };

    setPrefs(prefsRef.current);
  }, [storedPreferences]);

  /**
   * Applies a change at once and saves it; restores the previous values if the save fails.
   *
   * @param patch - Fields to change (sent as is: the back merges them).
   * @returns Resolves once saved; rejects with the save error.
   */
  const save = useCallback(async (patch: WidgetPreferences): Promise<void> => {
    const previous = prefsRef.current;
    prefsRef.current = { ...previous, ...patch };
    setPrefs(prefsRef.current);
    if (patch.collapsed) writeStoredCollapsedStates(patch.collapsed);
    const activeToken = tokenRef.current;
    if (!activeToken) return;

    pendingSavesRef.current += 1;
    const queued = saveQueueRef.current.then(() => saveWidgetPreference(activeToken, patch));
    saveQueueRef.current = queued.catch(() => undefined);
    try {
      await queued;
      savedThisSessionRef.current = { ...savedThisSessionRef.current, ...patch };
    } catch (error) {
      logger.error('Failed to save widget preferences', error);
      // Only the keys this change still holds go back: a later change of the same key stays.
      const rollback = Object.fromEntries(
        (Object.keys(patch) as (keyof WidgetPreferences)[])
          .filter((key) => prefsRef.current[key] === patch[key])
          .map((key) => [key, previous[key]]),
      ) as WidgetPreferences;
      prefsRef.current = { ...prefsRef.current, ...rollback };
      setPrefs(prefsRef.current);
      if ('collapsed' in rollback) writeStoredCollapsedStates(rollback.collapsed ?? {});
      throw error;
    } finally {
      pendingSavesRef.current -= 1;
    }
  }, []);

  /** Saves a change from a control that has no error display of its own: a toast tells why it moved back. */
  const saveSilently = useCallback(
    (patch: WidgetPreferences) => {
      save(patch).catch((error) => notifySaveFailure(error, 'la disposition'));
    },
    [save],
  );

  const setCollapsed = useCallback(
    (widgetId: string, collapsed: boolean) =>
      saveSilently({ collapsed: { ...prefsRef.current.collapsed, [widgetId]: collapsed } }),
    [saveSilently],
  );
  const unfoldOnly = useCallback(
    (widgetIds: readonly string[], unfolded: readonly string[]) => {
      // On a wide screen everything is unfolded already: the phone's folding stays untouched.
      if (!canFoldRef.current) return;
      const current = prefsRef.current.collapsed ?? {};
      const wanted = Object.fromEntries(widgetIds.map((id) => [id, !unfolded.includes(id)]));
      // Following the same link twice saves nothing the second time.
      if (Object.entries(wanted).every(([id, collapsed]) => current[id] === collapsed)) return;
      saveSilently({ collapsed: { ...current, ...wanted } });
    },
    [saveSilently],
  );
  const updateOrder = useCallback(
    (widgetOrder: string[]) => saveSilently({ widgetOrder }),
    [saveSilently],
  );
  const updateRoomOrder = useCallback(
    (roomOrder: string[]) => saveSilently({ roomOrder }),
    [saveSilently],
  );
  const updateFloorOrder = useCallback(
    (floorOrder: string[]) => saveSilently({ floorOrder }),
    [saveSilently],
  );
  const updateRoomIcon = useCallback(
    (room: string, iconName: string) =>
      saveSilently({ roomIcons: { ...prefsRef.current.roomIcons, [room]: iconName } }),
    [saveSilently],
  );
  const toggleWidgetVisibility = useCallback(
    (id: string) => saveSilently({ hiddenWidgets: toggled(prefsRef.current.hiddenWidgets, id) }),
    [saveSilently],
  );
  const toggleRoomVisibility = useCallback(
    (name: string) => saveSilently({ hiddenRooms: toggled(prefsRef.current.hiddenRooms, name) }),
    [saveSilently],
  );
  const toggleSensorVisibility = useCallback(
    (entityId: string) =>
      saveSilently({ hiddenSensors: toggled(prefsRef.current.hiddenSensors, entityId) }),
    [saveSilently],
  );

  const updateThresholds = useCallback(
    ({ temp, hum, notifications }: ThresholdsUpdate) => {
      const current = prefsRef.current;
      return save({
        tempThresholds: { ...DEFAULT_TEMP_THRESHOLDS, ...current.tempThresholds, ...temp },
        humThresholds: { ...DEFAULT_HUM_THRESHOLDS, ...current.humThresholds, ...hum },
        ...notifications,
      });
    },
    [save],
  );

  const value = useMemo<WidgetPreferencesContextType>(() => {
    const hiddenWidgets = prefs.hiddenWidgets ?? [];
    const hiddenRooms = prefs.hiddenRooms ?? [];
    const hiddenSensors = prefs.hiddenSensors ?? [];
    const collapsed = prefs.collapsed ?? {};
    return {
      canFold,
      // On a phone, all widgets are collapsed by default, unless expanded by the user. In test mode
      // they start expanded to avoid flaky header-click expansion in E2E tests.
      isCollapsed: (widgetId) => canFold && (collapsed[widgetId] ?? !isTestMode),
      setCollapsed,
      unfoldOnly,
      widgetOrder: normalizeOrder(prefs.widgetOrder),
      updateOrder,
      roomOrder: prefs.roomOrder ?? [],
      updateRoomOrder,
      floorOrder: prefs.floorOrder ?? [],
      updateFloorOrder,
      hiddenWidgets,
      toggleWidgetVisibility,
      isWidgetHidden: (id) => hiddenWidgets.includes(id),
      hiddenRooms,
      toggleRoomVisibility,
      isRoomHidden: (name) => hiddenRooms.includes(name),
      hiddenSensors,
      toggleSensorVisibility,
      isSensorHidden: (entityId) => hiddenSensors.includes(entityId),
      tempThresholds: { ...DEFAULT_TEMP_THRESHOLDS, ...prefs.tempThresholds },
      humThresholds: { ...DEFAULT_HUM_THRESHOLDS, ...prefs.humThresholds },
      ...DEFAULT_NOTIFICATION_THRESHOLDS,
      ...Object.fromEntries(
        Object.keys(DEFAULT_NOTIFICATION_THRESHOLDS)
          .filter((key) => prefs[key as keyof NotificationThresholds] !== undefined)
          .map((key) => [key, prefs[key as keyof NotificationThresholds]]),
      ),
      updateThresholds,
      roomIcons: prefs.roomIcons ?? {},
      updateRoomIcon,
    };
  }, [
    prefs,
    canFold,
    setCollapsed,
    unfoldOnly,
    updateOrder,
    updateRoomOrder,
    updateFloorOrder,
    toggleWidgetVisibility,
    toggleRoomVisibility,
    toggleSensorVisibility,
    updateThresholds,
    updateRoomIcon,
  ]);

  return <WidgetPreferencesContext value={value}>{children}</WidgetPreferencesContext>;
};

/**
 * Returns widget preferences from context.
 * Must be used within WidgetPreferencesProvider.
 *
 * @returns The preferences and their update functions.
 */
export const useWidgetPreferences = () => {
  const context = use(WidgetPreferencesContext);
  if (!context)
    throw new Error('useWidgetPreferences must be used within WidgetPreferencesProvider');
  return context;
};
