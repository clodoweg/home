/** SpaWidget tests — a reported disconnection warns without hiding a spa that still reports. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createQueryWrapper, createTestQueryClient } from '../../test/query-wrapper';
import type { HAState } from '../../services/client';
import { SpaWidget } from './SpaWidget';

vi.mock('../../context/WidgetPreferencesContext', () => ({
  useWidgetPreferences: () => ({ isCollapsed: () => false, setCollapsed: () => {} }),
}));
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: () => {} }),
}));
vi.mock('../../hooks/useHAHistory', () => ({
  useHAHistory: () => ({ series: [], labels: [], loading: false }),
}));
vi.mock('../../hooks/useHAState', () => ({
  useHAState: () => ({
    getEffectiveValue: (entity?: HAState) => entity?.state ?? null,
    performAction: vi.fn(),
  }),
}));

const state = (
  entityId: string,
  value: string,
  attributes: HAState['attributes'] = {},
): HAState => ({
  entity_id: entityId,
  state: value,
  attributes,
  last_changed: '2026-11-04T10:00:00Z',
  last_updated: '2026-11-04T10:00:00Z',
  context: {},
});

const thermostat = (value = 'heat') =>
  state('climate.spa_thermostat', value, { current_temperature: 40, temperature: 40 });

const renderSpa = (climate: HAState | undefined, connectedState?: string) =>
  render(
    <SpaWidget
      climate={climate}
      connected={connectedState ? state('binary_sensor.spa_connected', connectedState) : undefined}
      showHistory={false}
    />,
    { wrapper: createQueryWrapper(createTestQueryClient()) },
  );

describe('SpaWidget availability', () => {
  it('keeps the data and warns when the connectivity sensor is off', () => {
    renderSpa(thermostat(), 'off');

    expect(screen.queryByText('Spa non disponible')).not.toBeInTheDocument();
    expect(screen.getByText(/Connexion signalée coupée/)).toBeInTheDocument();
    expect(screen.getByText('Connexion coupée')).toBeInTheDocument();
  });

  it('shows no warning when the spa is connected', () => {
    renderSpa(thermostat(), 'on');

    expect(screen.queryByText(/Connexion signalée coupée/)).not.toBeInTheDocument();
  });

  it('shows no warning when the connectivity sensor does not exist', () => {
    renderSpa(thermostat());

    expect(screen.queryByText(/Connexion signalée coupée/)).not.toBeInTheDocument();
  });

  it.each([
    ['missing', undefined],
    ['unavailable', thermostat('unavailable')],
    ['unknown', thermostat('unknown')],
  ])('reports the spa as unavailable when the thermostat is %s', (_label, climate) => {
    renderSpa(climate, 'on');

    expect(screen.getByText('Spa non disponible')).toBeInTheDocument();
  });
});
