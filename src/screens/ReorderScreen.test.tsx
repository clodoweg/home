/** ReorderScreen tests — tabs, widget/room/sensor visibility, room icons, reorder handlers and threshold validation/saving. */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DragEndEvent } from '@dnd-kit/core';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HAState } from '../services/api';
import type { useWidgetPreferences } from '../context/WidgetPreferencesContext';
import { ReorderScreen } from './ReorderScreen';

type Preferences = ReturnType<typeof useWidgetPreferences>;
type DragEnd = (event: DragEndEvent) => void;

const state = vi.hoisted(() => ({
  prefs: null as unknown as Preferences,
  user: { canAccessHistory: true, canAccessCameras: true, isAdmin: false },
  /** onDragEnd of the widgets list, of the floors list, and of each floor's rooms (render order). */
  dragEnds: {
    widgets: null as DragEnd | null,
    floors: null as DragEnd | null,
    rooms: [] as DragEnd[],
  },
}));

vi.mock('../context/WidgetPreferencesContext', () => ({
  useWidgetPreferences: () => state.prefs,
}));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => state.user,
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: () => {}, setTheme: () => {} }),
}));

// Real dnd-kit contexts, with their drop handlers recorded so the reorder logic can be driven
// without simulating pointer drags in jsdom.
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  const { createElement } = await import('react');
  const RecordingDndContext = (props: React.ComponentProps<typeof actual.DndContext>) => {
    const onDragEnd = props.onDragEnd as DragEnd;
    if (onDragEnd.name === 'handleWidgetDragEnd') state.dragEnds.widgets = onDragEnd;
    else if (onDragEnd.name === 'handleFloorDragEnd') {
      state.dragEnds.floors = onDragEnd;
      state.dragEnds.rooms = [];
    } else state.dragEnds.rooms.push(onDragEnd);
    return createElement(actual.DndContext, props);
  };
  return { ...actual, DndContext: RecordingDndContext };
});

const TEMP = {
  tempIndoorMinRed: 15,
  tempIndoorMinOrange: 18,
  tempIndoorMaxOrange: 25,
  tempIndoorMaxRed: 30,
  tempOutdoorMinRed: 0,
  tempOutdoorMinOrange: 10,
  tempOutdoorMaxOrange: 28,
  tempOutdoorMaxRed: 32,
};
const HUM = {
  humIndoorMinRed: 30,
  humIndoorMinOrange: 40,
  humIndoorMaxOrange: 60,
  humIndoorMaxRed: 70,
  humOutdoorMinRed: 30,
  humOutdoorMinOrange: 40,
  humOutdoorMaxOrange: 60,
  humOutdoorMaxRed: 70,
};

const makePrefs = (overrides: Partial<Preferences> = {}): Preferences => {
  const hidden = (list: string[]) => (id: string) => list.includes(id);
  return {
    canFold: true,
    isCollapsed: () => true,
    setCollapsed: vi.fn(),
    unfoldOnly: vi.fn(),
    widgetOrder: ['weather', 'electricity', 'gas', 'water', 'arlo', 'spa', 'mystery'],
    updateOrder: vi.fn(),
    roomOrder: [],
    updateRoomOrder: vi.fn(),
    floorOrder: [],
    updateFloorOrder: vi.fn(),
    hiddenWidgets: [],
    toggleWidgetVisibility: vi.fn(),
    isWidgetHidden: hidden([]),
    hiddenRooms: [],
    toggleRoomVisibility: vi.fn(),
    isRoomHidden: hidden([]),
    hiddenSensors: [],
    toggleSensorVisibility: vi.fn(),
    isSensorHidden: hidden([]),
    tempThresholds: TEMP,
    humThresholds: HUM,
    notificationSpaTempThreshold: 37,
    notificationHumidityThreshold: 60,
    notificationTempMinThreshold: 15,
    notificationTempMaxThreshold: 30,
    notificationHumidityMinThreshold: 30,
    notificationHumidityMaxThreshold: 70,
    updateThresholds: vi.fn(async () => {}),
    roomIcons: {},
    updateRoomIcon: vi.fn(),
    ...overrides,
  };
};

const sensor = (
  entity_id: string,
  friendly_name?: string,
  device_class = 'temperature',
): HAState => ({
  entity_id,
  state: '20',
  attributes: { device_class, ...(friendly_name ? { friendly_name } : {}) },
  last_changed: '',
  last_updated: '',
  context: {},
});

const ROOMS = [
  { room: 'Salon', floor: 'RdC' },
  { room: 'Cuisine', floor: 'RdC' },
  { room: 'Chambre', floor: 'Étage' },
  { room: 'Garage', floor: '' },
];

const drop = (handler: DragEnd | null, activeId: string, overId: string | null) =>
  act(() =>
    handler!({
      active: { id: activeId },
      over: overId === null ? null : { id: overId },
    } as unknown as DragEndEvent),
  );

const renderScreen = (props: Partial<React.ComponentProps<typeof ReorderScreen>> = {}) =>
  render(<ReorderScreen onNavigate={vi.fn()} {...props} />);

const widgetTitles = () =>
  screen
    .getAllByRole('button', { name: /^(Masquer|Afficher) / })
    .map((b) => b.getAttribute('aria-label')!.replace(/^(Masquer|Afficher) /, ''));

beforeEach(() => {
  state.prefs = makePrefs();
  state.user = { canAccessHistory: true, canAccessCameras: true, isAdmin: false };
  state.dragEnds = { widgets: null, floors: null, rooms: [] };
});

describe('ReorderScreen — tabs', () => {
  it('opens on the widgets tab and switches between the three tabs', async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByTestId('reorder-tab-widgets')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByTestId('reorder-tab-rooms'));
    expect(screen.getByTestId('reorder-tab-rooms')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('reorder-tab-widgets')).toHaveAttribute('aria-selected', 'false');
    await user.click(screen.getByTestId('reorder-tab-thresholds'));
    expect(screen.getByRole('button', { name: 'Sauvegarder les seuils' })).toBeInTheDocument();
    await user.click(screen.getByTestId('reorder-tab-widgets'));
    expect(screen.getByText('Météo')).toBeInTheDocument();
  });
});

describe('ReorderScreen — widgets tab', () => {
  it('lists the saved order, unknown ids shown with the Lights config', () => {
    renderScreen();
    expect(widgetTitles()).toEqual([
      'Météo',
      'Électricité',
      'Gaz',
      'Eau',
      'Caméras',
      'Spa',
      'Lumières',
    ]);
  });

  it('leaves out the widgets the user has no right to', () => {
    state.user = { canAccessHistory: false, canAccessCameras: false, isAdmin: false };
    renderScreen();
    expect(widgetTitles()).toEqual(['Météo', 'Spa', 'Lumières']);
  });

  it('toggles a widget visibility and shows hidden ones as such', async () => {
    const user = userEvent.setup();
    state.prefs = makePrefs({ isWidgetHidden: (id) => id === 'gas' });
    renderScreen();

    expect(screen.getByRole('button', { name: 'Afficher Gaz' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Masquer Spa' }));
    expect(state.prefs.toggleWidgetVisibility).toHaveBeenCalledWith('spa');
  });

  it('saves the order after a drop on another widget, not on itself or outside', () => {
    renderScreen();

    drop(state.dragEnds.widgets, 'spa', 'spa');
    expect(state.prefs.updateOrder).not.toHaveBeenCalled();

    drop(state.dragEnds.widgets, 'spa', 'weather');
    expect(state.prefs.updateOrder).toHaveBeenCalledWith([
      'spa',
      'weather',
      'electricity',
      'gas',
      'water',
      'arlo',
      'mystery',
    ]);
    expect(widgetTitles()[0]).toBe('Spa');
  });

  it('B27: ignores a drop outside any target or on an unknown item', async () => {
    renderScreen({ availableRooms: ROOMS });

    drop(state.dragEnds.widgets, 'spa', null);
    drop(state.dragEnds.widgets, 'spa', 'unknown');
    expect(state.prefs.updateOrder).not.toHaveBeenCalled();
    expect(widgetTitles()[0]).toBe('Météo');

    await userEvent.setup().click(screen.getByTestId('reorder-tab-rooms'));
    drop(state.dragEnds.floors, 'RdC', null);
    drop(state.dragEnds.floors, 'Grenier', 'RdC');
    expect(state.prefs.updateFloorOrder).not.toHaveBeenCalled();

    // A room dragged onto a floor where it does not belong would be saved as `undefined`.
    drop(state.dragEnds.rooms[0], 'Salon', 'Chambre');
    drop(state.dragEnds.rooms[0], 'Salon', null);
    expect(state.prefs.updateRoomOrder).not.toHaveBeenCalled();
  });
});

describe('ReorderScreen — rooms tab', () => {
  it('says so when no room is known', async () => {
    renderScreen();
    await userEvent.setup().click(screen.getByTestId('reorder-tab-rooms'));
    expect(screen.getByText(/Aucune pièce détectée/)).toBeInTheDocument();
  });

  it('groups rooms by floor: saved order first, new ones alphabetically, no floor = Autres', async () => {
    state.prefs = makePrefs({ floorOrder: ['RdC', 'Grenier'], roomOrder: ['Salon', 'Bureau'] });
    renderScreen({ availableRooms: ROOMS });
    await userEvent.setup().click(screen.getByTestId('reorder-tab-rooms'));

    const floors = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(floors).toEqual(['RdC', 'Autres', 'Étage']);
    const rooms = screen.getAllByTestId(/^room-item-/).map((el) => el.dataset.testid);
    expect(rooms).toEqual([
      'room-item-Salon',
      'room-item-Cuisine',
      'room-item-Garage',
      'room-item-Chambre',
    ]);
  });

  it('shows saved floors but not saved rooms when no live room is known', async () => {
    state.prefs = makePrefs({ floorOrder: ['RdC'], roomOrder: ['Salon'] });
    renderScreen();
    await userEvent.setup().click(screen.getByTestId('reorder-tab-rooms'));

    // Saved rooms have no live floor, so they fall into "Autres", which is not a saved floor.
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('RdC');
    expect(screen.queryByTestId('room-item-Salon')).not.toBeInTheDocument();

    // A drop inside a floor with no live room changes nothing (it used to save [undefined], B27).
    drop(state.dragEnds.rooms[0], 'Salon', 'Cuisine');
    expect(state.prefs.updateRoomOrder).not.toHaveBeenCalled();
  });

  it('toggles a room and lists its temperature sensors with short labels', async () => {
    const user = userEvent.setup();
    const sensors = [
      sensor('sensor.salon_temperature', 'Température Salon'),
      sensor('sensor.salon_t2', 'Salon temperature'),
      sensor('sensor.salon_t3', 'Température'),
      sensor('sensor.salon_t5', 'TEMPÉRATURE'),
      sensor('sensor.salon_t6'),
      sensor('sensor.salon_hum', 'Humidité Salon', 'humidity'),
      sensor('sensor.orphan', 'Thermo orphelin'),
      sensor('sensor.salon_t4', 'Fenêtre'),
    ];
    const metadata = {
      'sensor.salon_temperature': { area: 'Salon', model: 'Aqara' },
      'sensor.salon_t2': { area: 'Salon', model: 'sensor' },
      'sensor.salon_t3': { area: 'Salon', model: 'Sonoff' },
      'sensor.salon_t5': { area: 'Salon', model: '' },
      'sensor.salon_t6': { area: 'Salon', model: 'Sonoff' },
      'sensor.salon_hum': { area: 'Salon', model: 'Aqara' },
      'sensor.salon_t4': { area: 'Salon', model: 'Aqara' },
    };
    state.prefs = makePrefs({ isSensorHidden: (id) => id === 'sensor.salon_t4' });
    renderScreen({
      availableRooms: [...ROOMS, { room: 'Autres', floor: 'RdC' }],
      sensors,
      metadata,
    });
    await user.click(screen.getByTestId('reorder-tab-rooms'));

    const salon = within(screen.getByTestId('room-item-Salon'));
    expect(
      salon
        .getAllByRole('button', { name: /^(Masquer|Afficher) / })
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([
      'Masquer Salon',
      'Masquer Aqara',
      'Masquer Capteur',
      'Masquer Sonoff',
      'Masquer Capteur',
      // No friendly name: the entity id, minus the room name, is used.
      'Masquer Sensor._t6',
      'Afficher Fenêtre',
    ]);
    expect(
      within(screen.getByTestId('room-item-Autres')).getByText('Thermo orphelin'),
    ).toBeVisible();

    await user.click(salon.getByRole('button', { name: 'Masquer Sonoff' }));
    expect(state.prefs.toggleSensorVisibility).toHaveBeenCalledWith('sensor.salon_t3');
    await user.click(salon.getByRole('button', { name: 'Masquer Salon' }));
    expect(state.prefs.toggleRoomVisibility).toHaveBeenCalledWith('Salon');
  });

  it('hides the sensor list of a hidden room', async () => {
    state.prefs = makePrefs({ isRoomHidden: (name) => name === 'Salon' });
    renderScreen({
      availableRooms: ROOMS,
      sensors: [sensor('sensor.salon_temperature', 'Température Salon')],
      metadata: { 'sensor.salon_temperature': { area: 'Salon', model: 'Aqara' } },
    });
    await userEvent.setup().click(screen.getByTestId('reorder-tab-rooms'));

    const salon = within(screen.getByTestId('room-item-Salon'));
    expect(salon.getByRole('button', { name: 'Afficher Salon' })).toBeInTheDocument();
    expect(salon.queryByText('Capteurs de température')).not.toBeInTheDocument();
  });

  it('saves the floor order and the room order inside a floor after a drop', async () => {
    renderScreen({ availableRooms: ROOMS });
    await userEvent.setup().click(screen.getByTestId('reorder-tab-rooms'));
    // Floors: Autres, Étage, RdC. Rooms: Chambre, Cuisine, Garage, Salon.

    drop(state.dragEnds.floors, 'RdC', 'RdC');
    expect(state.prefs.updateFloorOrder).not.toHaveBeenCalled();
    drop(state.dragEnds.floors, 'RdC', 'Autres');
    expect(state.prefs.updateFloorOrder).toHaveBeenCalledWith(['RdC', 'Autres', 'Étage']);

    // Rooms of RdC (now first floor): Cuisine, Salon.
    drop(state.dragEnds.rooms[0], 'Salon', 'Salon');
    expect(state.prefs.updateRoomOrder).not.toHaveBeenCalled();
    drop(state.dragEnds.rooms[0], 'Salon', 'Cuisine');
    expect(state.prefs.updateRoomOrder).toHaveBeenCalledWith([
      'Chambre',
      'Salon',
      'Cuisine',
      'Garage',
    ]);
  });

  it('picks, resets and cancels a room icon', async () => {
    const user = userEvent.setup();
    state.prefs = makePrefs({ roomIcons: { Cuisine: 'ChefHat' } });
    renderScreen({ availableRooms: ROOMS });
    await user.click(screen.getByTestId('reorder-tab-rooms'));

    await user.click(screen.getByRole('button', { name: "Modifier l'icône de Salon" }));
    expect(screen.getByText(/Choisir une icône pour/)).toHaveTextContent(
      'Choisir une icône pour Salon',
    );
    // No custom icon: the icon guessed from the name is preselected.
    expect(screen.getByTitle('Salon (Lampe)')).toHaveClass('border-primary');
    expect(screen.getByTitle('Chambre (Lit)')).not.toHaveClass('border-primary');
    await user.click(screen.getByTitle('Chambre (Lit)'));
    expect(state.prefs.updateRoomIcon).toHaveBeenCalledWith('Salon', 'Bed');
    expect(screen.queryByText(/Choisir une icône pour/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "Modifier l'icône de Cuisine" }));
    expect(screen.getByTitle('Cuisine (Toque)')).toHaveClass('border-primary');
    expect(screen.getByTitle('Cuisine (Soleil)')).not.toHaveClass('border-primary');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser par défaut' }));
    expect(state.prefs.updateRoomIcon).toHaveBeenLastCalledWith('Cuisine', '');

    await user.click(screen.getByRole('button', { name: "Modifier l'icône de Salon" }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText(/Choisir une icône pour/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Modifier l'icône de Salon" }));
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByText(/Choisir une icône pour/)).not.toBeInTheDocument();
    expect(state.prefs.updateRoomIcon).toHaveBeenCalledTimes(2);
  });
});

describe('ReorderScreen — thresholds tab', () => {
  const openThresholds = async () => {
    const user = userEvent.setup();
    const view = renderScreen();
    await user.click(screen.getByTestId('reorder-tab-thresholds'));
    return { user, view, inputs: () => screen.getAllByRole('spinbutton') as HTMLInputElement[] };
  };

  const save = () =>
    act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Sauvegarder les seuils|Sauvegarde/ }));
    });

  it('shows the 16 dashboard thresholds and no Telegram section for a non-admin', async () => {
    const { inputs } = await openThresholds();

    expect(inputs().map((i) => Number(i.value))).toEqual([
      ...Object.values(TEMP),
      ...Object.values(HUM),
    ]);
    expect(screen.queryByText(/Notifications Telegram/)).not.toBeInTheDocument();
  });

  it('saves the edited thresholds without the Telegram values for a non-admin', async () => {
    const { inputs } = await openThresholds();

    fireEvent.change(inputs()[0], { target: { value: '16.5' } });
    fireEvent.change(inputs()[8], { target: { value: '35.7' } });
    await save();

    expect(state.prefs.updateThresholds).toHaveBeenCalledWith({
      temp: { ...TEMP, tempIndoorMinRed: 16.5 },
      hum: { ...HUM, humIndoorMinRed: 35 },
      notifications: undefined,
    });
    expect(screen.getByText('Seuils sauvegardés avec succès !')).toHaveClass('text-success');
  });

  it('disables the button while saving', async () => {
    let finish: () => void = () => {};
    state.prefs = makePrefs({
      updateThresholds: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))),
    });
    await openThresholds();

    await save();
    expect(screen.getByRole('button', { name: 'Sauvegarde...' })).toBeDisabled();

    await act(async () => finish());
    expect(screen.getByRole('button', { name: 'Sauvegarder les seuils' })).toBeEnabled();
  });

  it('reports a rejected save', async () => {
    state.prefs = makePrefs({
      updateThresholds: vi.fn(async () => Promise.reject(new Error('x'))),
    });
    await openThresholds();

    await save();

    expect(screen.getByText('Erreur lors de la sauvegarde.')).toHaveClass('text-destructive');
  });

  it.each([
    [
      0,
      '18',
      'Température intérieure : Le seuil rouge minimal doit être inférieur au seuil orange minimal.',
    ],
    [
      1,
      '25',
      'Température intérieure : Le seuil orange minimal doit être inférieur au seuil orange maximal.',
    ],
    [
      2,
      '30',
      'Température intérieure : Le seuil orange maximal doit être inférieur au seuil rouge maximal.',
    ],
    [
      4,
      '10',
      'Température extérieure : Le seuil rouge minimal doit être inférieur au seuil orange minimal.',
    ],
    [
      5,
      '28',
      'Température extérieure : Le seuil orange minimal doit être inférieur au seuil orange maximal.',
    ],
    [
      6,
      '32',
      'Température extérieure : Le seuil orange maximal doit être inférieur au seuil rouge maximal.',
    ],
    [
      8,
      '40',
      'Humidité intérieure : Le seuil rouge minimal doit être inférieur au seuil orange minimal.',
    ],
    [
      9,
      '60',
      'Humidité intérieure : Le seuil orange minimal doit être inférieur au seuil orange maximal.',
    ],
    [
      10,
      '70',
      'Humidité intérieure : Le seuil orange maximal doit être inférieur au seuil rouge maximal.',
    ],
    [
      12,
      '40',
      'Humidité extérieure : Le seuil rouge minimal doit être inférieur au seuil orange minimal.',
    ],
    [
      13,
      '60',
      'Humidité extérieure : Le seuil orange minimal doit être inférieur au seuil orange maximal.',
    ],
    [
      14,
      '70',
      'Humidité extérieure : Le seuil orange maximal doit être inférieur au seuil rouge maximal.',
    ],
  ])('refuses input #%i = %s: %s', async (index, value, message) => {
    const { inputs } = await openThresholds();

    fireEvent.change(inputs()[index], { target: { value } });
    await save();

    expect(screen.getByText(message)).toHaveClass('text-destructive');
    expect(state.prefs.updateThresholds).not.toHaveBeenCalled();
  });

  it('accepts the inputs that the other branches leave untouched', async () => {
    const { inputs } = await openThresholds();
    // Every remaining input (3, 7, 11, 15) is a max: raising it keeps the ordering valid.
    for (const index of [3, 7, 11, 15]) {
      fireEvent.change(inputs()[index], { target: { value: '99' } });
    }
    await save();
    expect(state.prefs.updateThresholds).toHaveBeenCalledWith({
      temp: { ...TEMP, tempIndoorMaxRed: 99, tempOutdoorMaxRed: 99 },
      hum: { ...HUM, humIndoorMaxRed: 99, humOutdoorMaxRed: 99 },
      notifications: undefined,
    });
  });

  it('turns an empty or invalid entry into 0', async () => {
    const { inputs } = await openThresholds();

    inputs().forEach((input) => {
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
    });

    expect(inputs().map((input) => input.value)).toEqual(new Array(16).fill('0'));
  });

  it('B16: lets the user type a negative threshold digit by digit', async () => {
    const { user, inputs } = await openThresholds();

    await user.clear(inputs()[4]);
    await user.type(inputs()[4], '-5');
    await save();

    expect(inputs()[4].value).toBe('-5');
    expect(state.prefs.updateThresholds).toHaveBeenCalledWith(
      expect.objectContaining({ temp: { ...TEMP, tempOutdoorMinRed: -5 } }),
    );
  });

  it('keeps the edits when another preference changes', async () => {
    const { view, inputs } = await openThresholds();
    fireEvent.change(inputs()[0], { target: { value: '16.5' } });

    state.prefs = makePrefs({ hiddenWidgets: ['spa'] });
    view.rerender(<ReorderScreen onNavigate={vi.fn()} />);

    expect(inputs()[0].value).toBe('16.5');
  });

  it('follows threshold changes coming from the preferences', async () => {
    const { view, inputs } = await openThresholds();

    state.prefs = makePrefs({
      tempThresholds: { ...TEMP, tempIndoorMinRed: 12 },
      humThresholds: { ...HUM, humOutdoorMaxRed: 80 },
    });
    view.rerender(<ReorderScreen onNavigate={vi.fn()} />);

    expect(inputs()[0].value).toBe('12');
    expect(inputs()[15].value).toBe('80');
  });

  describe('admin Telegram section', () => {
    beforeEach(() => {
      state.user = { ...state.user, isAdmin: true };
    });

    it('shows the Telegram thresholds and saves them with the dashboard ones', async () => {
      await openThresholds();

      expect(screen.getByText('Seuils de Notifications Telegram (Admin)')).toBeInTheDocument();
      fireEvent.change(screen.getByTestId('input-telegram-spa'), { target: { value: '38.5' } });
      fireEvent.change(screen.getByTestId('input-telegram-temp-min'), { target: { value: '12' } });
      fireEvent.change(screen.getByTestId('input-telegram-temp-max'), { target: { value: '29' } });
      fireEvent.change(screen.getByTestId('input-telegram-hum-min'), { target: { value: '25' } });
      fireEvent.change(screen.getByTestId('input-telegram-hum-max'), { target: { value: '75.9' } });
      await save();

      expect(state.prefs.updateThresholds).toHaveBeenCalledWith({
        temp: TEMP,
        hum: HUM,
        notifications: {
          notificationSpaTempThreshold: 38.5,
          notificationTempMinThreshold: 12,
          notificationTempMaxThreshold: 29,
          notificationHumidityMinThreshold: 25,
          notificationHumidityMaxThreshold: 75,
        },
      });
    });

    it('turns empty Telegram entries into 0', async () => {
      await openThresholds();
      for (const id of ['spa', 'temp-min', 'temp-max', 'hum-min', 'hum-max']) {
        fireEvent.change(screen.getByTestId(`input-telegram-${id}`), { target: { value: '' } });
        fireEvent.blur(screen.getByTestId(`input-telegram-${id}`));
        expect(screen.getByTestId(`input-telegram-${id}`)).toHaveValue(0);
      }
    });

    it.each([
      [
        'spa',
        '-1',
        'Notifications Telegram Spa : La température doit être comprise entre 0°C et 50°C.',
      ],
      [
        'spa',
        '51',
        'Notifications Telegram Spa : La température doit être comprise entre 0°C et 50°C.',
      ],
      [
        'temp-min',
        '-1',
        'Notifications Telegram Température Min : La température doit être comprise entre 0°C et 50°C.',
      ],
      [
        'temp-min',
        '51',
        'Notifications Telegram Température Min : La température doit être comprise entre 0°C et 50°C.',
      ],
      [
        'temp-max',
        '-1',
        'Notifications Telegram Température Max : La température doit être comprise entre 0°C et 50°C.',
      ],
      [
        'temp-max',
        '51',
        'Notifications Telegram Température Max : La température doit être comprise entre 0°C et 50°C.',
      ],
      [
        'temp-min',
        '30',
        'Notifications Telegram Température : Le seuil minimal doit être inférieur au seuil maximal.',
      ],
      [
        'hum-min',
        '-1',
        "Notifications Telegram Humidité Min : Le taux d'humidité doit être compris entre 0% et 100%.",
      ],
      [
        'hum-min',
        '101',
        "Notifications Telegram Humidité Min : Le taux d'humidité doit être compris entre 0% et 100%.",
      ],
      [
        'hum-max',
        '-1',
        "Notifications Telegram Humidité Max : Le taux d'humidité doit être compris entre 0% et 100%.",
      ],
      [
        'hum-max',
        '101',
        "Notifications Telegram Humidité Max : Le taux d'humidité doit être compris entre 0% et 100%.",
      ],
      [
        'hum-min',
        '70',
        'Notifications Telegram Humidité : Le seuil minimal doit être inférieur au seuil maximal.',
      ],
    ])('refuses Telegram %s = %s', async (id, value, message) => {
      await openThresholds();

      fireEvent.change(screen.getByTestId(`input-telegram-${id}`), { target: { value } });
      await save();

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(state.prefs.updateThresholds).not.toHaveBeenCalled();
    });

    it('follows Telegram threshold changes coming from the preferences', async () => {
      const { view } = await openThresholds();

      state.prefs = makePrefs({
        notificationSpaTempThreshold: 39,
        notificationTempMinThreshold: 10,
        notificationTempMaxThreshold: 27,
        notificationHumidityMinThreshold: 20,
        notificationHumidityMaxThreshold: 80,
      });
      view.rerender(<ReorderScreen onNavigate={vi.fn()} />);

      expect(screen.getByTestId('input-telegram-spa')).toHaveValue(39);
      expect(screen.getByTestId('input-telegram-temp-min')).toHaveValue(10);
      expect(screen.getByTestId('input-telegram-temp-max')).toHaveValue(27);
      expect(screen.getByTestId('input-telegram-hum-min')).toHaveValue(20);
      expect(screen.getByTestId('input-telegram-hum-max')).toHaveValue(80);
    });
  });
});
