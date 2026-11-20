/** WidgetPreferencesContext tests — preferences read from the profile, collapsed state, visibility toggles, orders and thresholds saved to the back with rollback. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import React, { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import {
  DEFAULT_HUM_THRESHOLDS,
  DEFAULT_TEMP_THRESHOLDS,
  WidgetPreferencesProvider,
  useWidgetPreferences,
} from './WidgetPreferencesContext';

const user = vi.hoisted(() => ({
  token: 'jwt' as string | null,
  profile: null as { widgetPreferences: unknown } | null,
}));

vi.mock('./UserContext', () => ({
  useUserProfile: () => user,
}));

const notifySaveFailure = vi.hoisted(() => vi.fn());
vi.mock('../lib/action-feedback', () => ({ notifySaveFailure }));

const PREFERENCES_URL = `${API_URL}/api/user/preferences`;

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

/** Gives the profile the given stored preferences and records every POST body. */
const mockPreferences = (
  preferences: Record<string, unknown> = {},
  { saveStatus = 200 }: { saveStatus?: number } = {},
) => {
  user.profile = { widgetPreferences: preferences };
  const saved: Record<string, unknown>[] = [];
  server.use(
    http.post(PREFERENCES_URL, async ({ request }) => {
      saved.push((await request.json()) as Record<string, unknown>);
      return saveStatus === 200
        ? HttpResponse.json({ ok: true })
        : HttpResponse.json({ error: 'save failed' }, { status: saveStatus });
    }),
  );
  return saved;
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WidgetPreferencesProvider>{children}</WidgetPreferencesProvider>
);

const renderPreferences = async () => renderHook(() => useWidgetPreferences(), { wrapper });

beforeEach(() => {
  // Folding is for phones: the provider is tested at a phone's width unless said otherwise.
  window.innerWidth = 390;
  notifySaveFailure.mockClear();
  user.token = 'jwt';
  user.profile = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('WidgetPreferencesProvider — loading', () => {
  it('starts from the defaults without a profile and never calls the back', async () => {
    user.token = null;
    const requested = vi.fn();
    server.use(http.all(PREFERENCES_URL, requested));

    const { result } = await renderPreferences();

    expect(requested).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({
      widgetOrder: DEFAULT_ORDER,
      roomOrder: [],
      floorOrder: [],
      hiddenWidgets: [],
      hiddenRooms: [],
      hiddenSensors: [],
      tempThresholds: DEFAULT_TEMP_THRESHOLDS,
      humThresholds: DEFAULT_HUM_THRESHOLDS,
      notificationSpaTempThreshold: 37,
      notificationHumidityThreshold: 60,
      notificationTempMinThreshold: 15,
      notificationTempMaxThreshold: 30,
      notificationHumidityMinThreshold: 30,
      notificationHumidityMaxThreshold: 70,
      roomIcons: {},
    });
  });

  it('applies the saved preferences, dropping removed widgets and appending new ones', async () => {
    mockPreferences({
      widgetOrder: ['water', 'sensors', 'lights'],
      roomOrder: ['Salon', 'Cuisine'],
      floorOrder: ['Étage', 'RdC'],
      hiddenWidgets: ['gas'],
      hiddenRooms: ['Cave'],
      hiddenSensors: ['sensor.cave_temperature'],
      tempThresholds: { tempIndoorMinRed: 12 },
      humThresholds: { humOutdoorMaxRed: 90 },
      notificationSpaTempThreshold: 38,
      notificationHumidityThreshold: 65,
      notificationTempMinThreshold: 0,
      notificationTempMaxThreshold: 28,
      notificationHumidityMinThreshold: 20,
      notificationHumidityMaxThreshold: 80,
      roomIcons: { Salon: 'Sofa' },
      collapsed: { lights: false },
    });

    const { result } = await renderPreferences();

    expect(result.current.widgetOrder).toEqual([
      'water',
      'lights',
      ...DEFAULT_ORDER.filter((w) => w !== 'water' && w !== 'lights'),
    ]);
    expect(result.current).toMatchObject({
      roomOrder: ['Salon', 'Cuisine'],
      floorOrder: ['Étage', 'RdC'],
      hiddenWidgets: ['gas'],
      hiddenRooms: ['Cave'],
      hiddenSensors: ['sensor.cave_temperature'],
      tempThresholds: { ...DEFAULT_TEMP_THRESHOLDS, tempIndoorMinRed: 12 },
      humThresholds: { ...DEFAULT_HUM_THRESHOLDS, humOutdoorMaxRed: 90 },
      notificationSpaTempThreshold: 38,
      notificationHumidityThreshold: 65,
      notificationTempMinThreshold: 0,
      notificationTempMaxThreshold: 28,
      notificationHumidityMinThreshold: 20,
      notificationHumidityMaxThreshold: 80,
      roomIcons: { Salon: 'Sofa' },
    });
    expect(result.current.isCollapsed('lights')).toBe(false);
    expect(result.current.isWidgetHidden('gas')).toBe(true);
    expect(result.current.isRoomHidden('Cave')).toBe(true);
    expect(result.current.isSensorHidden('sensor.cave_temperature')).toBe(true);
  });

  it('ignores saved values of the wrong shape', async () => {
    mockPreferences({
      widgetOrder: 'lights',
      roomOrder: {},
      floorOrder: null,
      hiddenWidgets: 'gas',
      hiddenRooms: 3,
      hiddenSensors: [1],
      tempThresholds: 'hot',
      humThresholds: null,
      roomIcons: 'Sofa',
      collapsed: 'yes',
      notificationSpaTempThreshold: '38',
    });

    const { result } = await renderPreferences();

    expect(result.current).toMatchObject({
      widgetOrder: DEFAULT_ORDER,
      roomOrder: [],
      floorOrder: [],
      hiddenWidgets: [],
      hiddenRooms: [],
      hiddenSensors: [],
      tempThresholds: DEFAULT_TEMP_THRESHOLDS,
      humThresholds: DEFAULT_HUM_THRESHOLDS,
      roomIcons: {},
      notificationSpaTempThreshold: 37,
    });
    expect(result.current.isWidgetHidden('g')).toBe(false);
    expect(result.current.isCollapsed('lights')).toBe(true);
  });

  it('adopts the preferences of a refreshed profile', async () => {
    mockPreferences({ widgetOrder: ['gas'] });
    const { result, rerender } = await renderPreferences();
    expect(result.current.widgetOrder[0]).toBe('gas');

    user.profile = { widgetPreferences: { widgetOrder: ['water'], hiddenRooms: ['Cave'] } };
    rerender();

    expect(result.current.widgetOrder[0]).toBe('water');
    expect(result.current.hiddenRooms).toEqual(['Cave']);
  });

  it('keeps a change being saved when the profile refreshes meanwhile', async () => {
    user.profile = { widgetPreferences: { widgetOrder: ['gas'] } };
    let release: () => void = () => {};
    server.use(
      http.post(PREFERENCES_URL, async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return HttpResponse.json({ ok: true });
      }),
    );
    const { result, rerender } = await renderPreferences();

    act(() => result.current.updateOrder(['water']));
    user.profile = { widgetPreferences: { widgetOrder: ['gas'] } };
    rerender();

    expect(result.current.widgetOrder[0]).toBe('water');
    await act(async () => release());
  });

  it('prefers the account collapsed states over the device copy', async () => {
    localStorage.setItem('widget-collapsed-states', JSON.stringify({ spa: false }));
    mockPreferences({ collapsed: { lights: false } });

    const { result } = await renderPreferences();

    expect(result.current.isCollapsed('lights')).toBe(false);
    expect(result.current.isCollapsed('spa')).toBe(true);
  });
});

describe('WidgetPreferencesProvider — collapsed state', () => {
  it('collapses every widget by default', async () => {
    mockPreferences();
    const { result } = await renderPreferences();
    expect(result.current.isCollapsed('anything')).toBe(true);
  });

  it('reads the collapsed states stored on the device', async () => {
    localStorage.setItem('widget-collapsed-states', JSON.stringify({ spa: false }));
    mockPreferences();
    const { result } = await renderPreferences();
    expect(result.current.isCollapsed('spa')).toBe(false);
  });

  it.each([['{broken'], ['true']])('ignores an unusable stored value %s', async (stored) => {
    localStorage.setItem('widget-collapsed-states', stored);
    mockPreferences();
    const { result } = await renderPreferences();
    expect(result.current.isCollapsed('spa')).toBe(true);
  });

  it('stores the change on the device and on the back', async () => {
    const saved = mockPreferences();
    const { result } = await renderPreferences();

    act(() => result.current.setCollapsed('spa', false));

    expect(result.current.isCollapsed('spa')).toBe(false);
    expect(JSON.parse(localStorage.getItem('widget-collapsed-states') ?? '{}')).toEqual({
      spa: false,
    });
    await waitFor(() => expect(saved).toEqual([{ collapsed: { spa: false } }]));
  });

  it('unfolds only the given widgets of a list, in one save', async () => {
    const saved = mockPreferences({ collapsed: { spa: false, lights: true } });
    const { result } = await renderPreferences();

    act(() => result.current.unfoldOnly(['lights', 'temperature', 'climate'], ['lights']));

    expect(result.current.isCollapsed('lights')).toBe(false);
    expect(result.current.isCollapsed('temperature')).toBe(true);
    // Widgets outside the list keep their state.
    expect(result.current.isCollapsed('spa')).toBe(false);
    await waitFor(() =>
      expect(saved).toEqual([
        { collapsed: { spa: false, lights: false, temperature: true, climate: true } },
      ]),
    );

    // Already in that state: nothing more to save.
    act(() => result.current.unfoldOnly(['lights', 'temperature', 'climate'], ['lights']));
    expect(saved).toHaveLength(1);
  });

  it('unfolds every widget on a wide screen and leaves the folding of the phone untouched', async () => {
    window.innerWidth = 1280;
    const saved = mockPreferences({ collapsed: { spa: true } });
    const { result } = await renderPreferences();

    expect(result.current.canFold).toBe(false);
    expect(result.current.isCollapsed('spa')).toBe(false);
    expect(result.current.isCollapsed('anything')).toBe(false);

    act(() => result.current.unfoldOnly(['spa', 'lights'], ['lights']));
    expect(saved).toHaveLength(0);
  });

  it('folds again when the window narrows to a phone width', async () => {
    window.innerWidth = 1280;
    mockPreferences({ collapsed: { spa: true } });
    const { result } = await renderPreferences();
    expect(result.current.isCollapsed('spa')).toBe(false);

    act(() => {
      window.innerWidth = 390;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.canFold).toBe(true);
    expect(result.current.isCollapsed('spa')).toBe(true);
  });

  it('still saves to the back when the device storage throws', async () => {
    const saved = mockPreferences();
    const { result } = await renderPreferences();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    act(() => result.current.setCollapsed('spa', false));

    await waitFor(() => expect(saved).toEqual([{ collapsed: { spa: false } }]));
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      'Failed to save collapsed state to localStorage',
      expect.any(Error),
    );
  });
});

describe('WidgetPreferencesProvider — saving', () => {
  it('saves orders, icons and visibility toggles to the back', async () => {
    const saved = mockPreferences();
    const { result } = await renderPreferences();

    act(() => result.current.updateOrder(['gas', 'water']));
    act(() => result.current.updateRoomOrder(['Salon']));
    act(() => result.current.updateFloorOrder(['RdC']));
    act(() => result.current.updateRoomIcon('Salon', 'Tv'));
    act(() => result.current.toggleWidgetVisibility('spa'));
    act(() => result.current.toggleRoomVisibility('Cave'));
    act(() => result.current.toggleSensorVisibility('sensor.a'));

    expect(result.current.widgetOrder.slice(0, 2)).toEqual(['gas', 'water']);
    expect(result.current).toMatchObject({
      roomOrder: ['Salon'],
      floorOrder: ['RdC'],
      roomIcons: { Salon: 'Tv' },
      hiddenWidgets: ['spa'],
      hiddenRooms: ['Cave'],
      hiddenSensors: ['sensor.a'],
    });
    await waitFor(() => expect(saved).toHaveLength(7));
    expect(saved).toEqual(
      expect.arrayContaining([
        { widgetOrder: ['gas', 'water'] },
        { roomOrder: ['Salon'] },
        { floorOrder: ['RdC'] },
        { roomIcons: { Salon: 'Tv' } },
        { hiddenWidgets: ['spa'] },
        { hiddenRooms: ['Cave'] },
        { hiddenSensors: ['sensor.a'] },
      ]),
    );

    act(() => result.current.toggleWidgetVisibility('spa'));
    act(() => result.current.toggleRoomVisibility('Cave'));
    act(() => result.current.toggleSensorVisibility('sensor.a'));

    expect(result.current.isWidgetHidden('spa')).toBe(false);
    expect(result.current.isRoomHidden('Cave')).toBe(false);
    expect(result.current.isSensorHidden('sensor.a')).toBe(false);
    await waitFor(() => expect(saved).toHaveLength(10));
    expect(saved.slice(7)).toEqual(
      expect.arrayContaining([{ hiddenWidgets: [] }, { hiddenRooms: [] }, { hiddenSensors: [] }]),
    );
  });

  it('logs and undoes each change the back refuses', async () => {
    const saved = mockPreferences({ hiddenWidgets: ['gas'] }, { saveStatus: 500 });
    const { result } = await renderPreferences();

    act(() => result.current.updateOrder(['water']));
    act(() => result.current.toggleWidgetVisibility('spa'));
    act(() => result.current.updateRoomIcon('Salon', 'Tv'));
    expect(result.current.widgetOrder[0]).toBe('water');
    expect(result.current.isWidgetHidden('spa')).toBe(true);

    await waitFor(() => expect(saved).toHaveLength(3));
    await waitFor(() => expect(result.current.widgetOrder).toEqual(DEFAULT_ORDER));
    expect(result.current.hiddenWidgets).toEqual(['gas']);
    expect(result.current.roomIcons).toEqual({});
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      'Failed to save widget preferences',
      expect.any(Error),
    );
    expect(notifySaveFailure).toHaveBeenCalledTimes(3);
    expect(notifySaveFailure).toHaveBeenCalledWith(expect.any(Error), 'la disposition');
  });

  it('changes everything locally only without a token', async () => {
    user.token = null;
    const saved = mockPreferences();
    const { result } = await renderPreferences();

    act(() => result.current.setCollapsed('spa', false));
    act(() => result.current.updateOrder(['gas']));
    act(() => result.current.updateRoomOrder(['Salon']));
    act(() => result.current.updateFloorOrder(['RdC']));
    act(() => result.current.updateRoomIcon('Salon', 'Tv'));
    act(() => result.current.toggleWidgetVisibility('spa'));
    act(() => result.current.toggleRoomVisibility('Cave'));
    act(() => result.current.toggleSensorVisibility('sensor.a'));
    await act(() =>
      result.current.updateThresholds({
        temp: { tempIndoorMinRed: 10 },
        notifications: { notificationSpaTempThreshold: 39 },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(saved).toHaveLength(0);
    expect(result.current.widgetOrder[0]).toBe('gas');
    expect(result.current).toMatchObject({
      hiddenSensors: ['sensor.a'],
      notificationSpaTempThreshold: 39,
    });
    expect(result.current.tempThresholds.tempIndoorMinRed).toBe(10);
  });
});

describe('WidgetPreferencesProvider — thresholds', () => {
  it('merges partial thresholds and sends only the notification values given', async () => {
    const saved = mockPreferences();
    const { result } = await renderPreferences();

    await act(() =>
      result.current.updateThresholds({
        temp: { tempIndoorMinRed: 14 },
        hum: { humIndoorMaxRed: 75 },
      }),
    );

    expect(saved).toEqual([
      {
        tempThresholds: { ...DEFAULT_TEMP_THRESHOLDS, tempIndoorMinRed: 14 },
        humThresholds: { ...DEFAULT_HUM_THRESHOLDS, humIndoorMaxRed: 75 },
      },
    ]);
    expect(result.current.notificationSpaTempThreshold).toBe(37);
  });

  it('saves every notification threshold given', async () => {
    const saved = mockPreferences();
    const { result } = await renderPreferences();

    await act(() =>
      result.current.updateThresholds({
        notifications: {
          notificationSpaTempThreshold: 38,
          notificationHumidityThreshold: 55,
          notificationTempMinThreshold: 12,
          notificationTempMaxThreshold: 29,
          notificationHumidityMinThreshold: 25,
          notificationHumidityMaxThreshold: 75,
        },
      }),
    );

    expect(saved).toEqual([
      {
        tempThresholds: DEFAULT_TEMP_THRESHOLDS,
        humThresholds: DEFAULT_HUM_THRESHOLDS,
        notificationSpaTempThreshold: 38,
        notificationHumidityThreshold: 55,
        notificationTempMinThreshold: 12,
        notificationTempMaxThreshold: 29,
        notificationHumidityMinThreshold: 25,
        notificationHumidityMaxThreshold: 75,
      },
    ]);
    expect(result.current).toMatchObject({
      notificationSpaTempThreshold: 38,
      notificationHumidityThreshold: 55,
      notificationTempMinThreshold: 12,
      notificationTempMaxThreshold: 29,
      notificationHumidityMinThreshold: 25,
      notificationHumidityMaxThreshold: 75,
    });
  });

  it('rejects and restores the previous thresholds when the save fails', async () => {
    mockPreferences({}, { saveStatus: 500 });
    const { result } = await renderPreferences();
    const before = result.current.tempThresholds.tempIndoorMinRed;

    await expect(
      act(() =>
        result.current.updateThresholds({
          temp: { tempIndoorMinRed: 14 },
          notifications: { notificationSpaTempThreshold: 39 },
        }),
      ),
    ).rejects.toThrow();
    expect(result.current.tempThresholds.tempIndoorMinRed).toBe(before);
    expect(result.current.notificationSpaTempThreshold).not.toBe(39);
  });
});

describe('WidgetPreferencesProvider — concurrent saves', () => {
  /** Serves POSTs in order with the given statuses, each held until released. */
  const holdSaves = (statuses: number[]) => {
    const releases: (() => void)[] = [];
    let call = 0;
    server.use(
      http.post(PREFERENCES_URL, async () => {
        const status = statuses[call++] ?? 200;
        await new Promise<void>((resolve) => releases.push(resolve));
        return status === 200
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ error: 'save failed' }, { status });
      }),
    );
    return releases;
  };

  it('keeps a newer change of the same key when an older save fails', async () => {
    user.profile = { widgetPreferences: {} };
    const releases = holdSaves([500, 200]);
    const { result } = await renderPreferences();

    act(() => result.current.toggleWidgetVisibility('spa'));
    act(() => result.current.toggleWidgetVisibility('gas'));
    // One save at a time: the second only leaves once the first has answered.
    await waitFor(() => expect(releases).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(releases).toHaveLength(1);
    await act(async () => releases[0]());
    await waitFor(() => expect(releases).toHaveLength(2));
    await act(async () => releases[1]());

    await waitFor(() => expect(notifySaveFailure).toHaveBeenCalled());
    expect(result.current.hiddenWidgets).toEqual(['spa', 'gas']);
  });

  it('restores the device copy of the collapsed states when their save fails', async () => {
    user.profile = { widgetPreferences: { collapsed: { spa: true } } };
    const releases = holdSaves([500]);
    const { result } = await renderPreferences();

    act(() => result.current.setCollapsed('spa', false));
    expect(JSON.parse(localStorage.getItem('widget-collapsed-states') ?? '{}')).toEqual({
      spa: false,
    });
    await waitFor(() => expect(releases).toHaveLength(1));
    await act(async () => releases[0]());

    await waitFor(() => expect(result.current.isCollapsed('spa')).toBe(true));
    expect(JSON.parse(localStorage.getItem('widget-collapsed-states') ?? '{}')).toEqual({
      spa: true,
    });
  });

  it('does not let an older profile undo a change saved meanwhile', async () => {
    mockPreferences({ widgetOrder: ['gas'] });
    const { result, rerender } = await renderPreferences();

    await act(async () => result.current.updateOrder(['water']));
    await waitFor(() => expect(result.current.widgetOrder[0]).toBe('water'));
    await new Promise((resolve) => setTimeout(resolve, 20));

    user.profile = { widgetPreferences: { widgetOrder: ['gas'], hiddenRooms: ['Cave'] } };
    rerender();

    expect(result.current.widgetOrder[0]).toBe('water');
    expect(result.current.hiddenRooms).toEqual(['Cave']);
  });
});

describe('WidgetPreferencesProvider — StrictMode', () => {
  it('B18: posts a visibility toggle once under StrictMode', async () => {
    const saved = mockPreferences();
    const strictWrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <WidgetPreferencesProvider>{children}</WidgetPreferencesProvider>
      </StrictMode>
    );
    const { result } = renderHook(() => useWidgetPreferences(), { wrapper: strictWrapper });

    act(() => result.current.toggleSensorVisibility('sensor.a'));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(saved).toEqual([{ hiddenSensors: ['sensor.a'] }]);
  });
});

describe('useWidgetPreferences', () => {
  it('throws outside of its provider', () => {
    expect(() => renderHook(() => useWidgetPreferences())).toThrow(
      'useWidgetPreferences must be used within WidgetPreferencesProvider',
    );
  });
});
