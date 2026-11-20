/** PlugsWidget tests — the daily energy baseline is fetched once per selected plug, not per poll. */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { createQueryWrapper, createTestQueryClient } from '../../test/query-wrapper';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/msw-server';
import { API_URL, type HAState } from '../../services/client';
import { PlugsWidget } from './PlugsWidget';

vi.mock('../../context/UserContext', () => ({
  useUserProfile: () => ({ token: 'jwt', canAccessHistory: true, refreshToken: async () => 'jwt' }),
}));
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: () => {} }),
}));
vi.mock('../../context/WidgetPreferencesContext', () => ({
  useWidgetPreferences: () => ({ isCollapsed: () => false, setCollapsed: () => {} }),
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

const state = (entityId: string, value: string): HAState => ({
  entity_id: entityId,
  state: value,
  attributes: {},
  last_changed: '2026-10-23T10:00:00Z',
  last_updated: '2026-10-23T10:00:00Z',
  context: {},
});

let historyRequests: string[];

beforeEach(() => {
  historyRequests = [];
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const beforeMidnight = new Date(midnight.getTime() - 60 * 60 * 1000).toISOString();
  server.use(
    http.get(`${API_URL}/api/ha/history`, ({ request }) => {
      historyRequests.push(new URL(request.url).searchParams.get('entity_id') ?? '');
      return HttpResponse.json([[{ state: '10', last_changed: beforeMidnight }]]);
    }),
  );
});

const renderPlugs = (energy: string) => (
  <PlugsWidget
    plugPC={state('switch.prise_pc', 'on')}
    powerPC={state('sensor.prise_pc_puissance', '50')}
    energyPC={state('sensor.prise_pc_consommation', energy)}
  />
);

describe('PlugsWidget daily energy', () => {
  it('fetches the baseline once and follows the live counter on later polls (B12)', async () => {
    const { rerender } = render(renderPlugs('12'), {
      wrapper: createQueryWrapper(createTestQueryClient()),
    });
    await userEvent.click(screen.getByTestId('plug-card-pc'));
    await waitFor(() => expect(screen.getByText('2.00')).toBeInTheDocument());

    // Three polls: a new energy entity object each time, with a growing counter.
    for (const energy of ['12.5', '13', '13.25']) rerender(renderPlugs(energy));

    await waitFor(() => expect(screen.getByText('3.25')).toBeInTheDocument());
    expect(historyRequests).toEqual(['sensor.prise_pc_consommation']);
  });

  it('fetches a new baseline after midnight while a plug stays selected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-23T23:58:00'));
    render(renderPlugs('12'), { wrapper: createQueryWrapper(createTestQueryClient()) });
    await userEvent.click(screen.getByTestId('plug-card-pc'));
    await waitFor(() => expect(historyRequests).toHaveLength(1));

    await act(() => vi.advanceTimersByTimeAsync(3 * 60_000));

    await waitFor(() => expect(historyRequests).toHaveLength(2));
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fixed bugs (regressions)', () => {
  it('B33: keeps the plug switch out of a button, and expands from a named button', async () => {
    const { container } = render(renderPlugs('12'), {
      wrapper: createQueryWrapper(createTestQueryClient()),
    });
    const expand = screen.getByRole('button', { name: /^Prise PC/ });

    expect(container.querySelector('button button')).toBeNull();
    expect(screen.getByTestId('plug-card-pc')).not.toHaveAttribute('aria-expanded');
    expect(screen.getByTestId('plug-toggle-pc')).toHaveAccessibleName('Éteindre Prise PC');
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expand.focus();
    await userEvent.keyboard('{Enter}');
    expect(expand).toHaveAttribute('aria-expanded', 'true');
  });
});
