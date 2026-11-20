/** LightsWidget tests — room names are plain text, never patterns. */
import { render, screen } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '../../test/query-wrapper';
import { describe, expect, it, vi } from 'vitest';
import type { HAState } from '../../services/client';
import { LightsWidget } from './LightsWidget';

vi.mock('../../context/UserContext', () => ({
  useUserProfile: () => ({
    token: 'jwt',
    canAccessHistory: false,
    refreshToken: async () => 'jwt',
  }),
}));
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: () => {} }),
}));
vi.mock('../../context/WidgetPreferencesContext', () => ({
  useWidgetPreferences: () => ({
    floorOrder: [],
    roomOrder: [],
    roomIcons: {},
    isRoomHidden: () => false,
    isCollapsed: () => false,
    setCollapsed: () => {},
  }),
}));

const entity = (entityId: string, friendlyName: string, state = 'on'): HAState => ({
  entity_id: entityId,
  state,
  attributes: { friendly_name: friendlyName, brightness: 128 },
  last_changed: '2026-10-23T10:00:00Z',
  last_updated: '2026-10-23T10:00:00Z',
  context: {},
});

describe('LightsWidget', () => {
  it('renders a room whose name contains regular-expression characters (B14)', () => {
    const area = 'Salon (bas';
    render(
      <LightsWidget
        lights={[entity('light.salon_bas', area)]}
        scenes={[entity('scene.salon_bas_soir', `${area} Soirée`, 'scening')]}
        metadata={{ 'light.salon_bas': { area, floor: 'RdC', model: 'Room' } }}
        onToggle={vi.fn()}
        onSetBrightness={vi.fn()}
      />,
      { wrapper: createQueryWrapper(createTestQueryClient()) },
    );

    expect(screen.getAllByText(area).length).toBeGreaterThan(0);
  });
});
