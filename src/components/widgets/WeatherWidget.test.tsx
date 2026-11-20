/** WeatherWidget tests — an unavailable entity shows a message and requests no forecast. */
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../../test/query-wrapper';
import { API_URL, type HAState } from '../../services/client';
import { WeatherWidget } from './WeatherWidget';

vi.mock('../../context/UserContext', () => ({
  useUserProfile: () => ({ token: 'jwt', canAccessHistory: true, refreshToken: async () => 'jwt' }),
}));
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: () => {} }),
}));
vi.mock('../../context/WidgetPreferencesContext', () => ({
  useWidgetPreferences: () => ({ isCollapsed: () => false, setCollapsed: () => {} }),
}));

const weather = (value: string): HAState => ({
  entity_id: 'weather.forecast_maison',
  state: value,
  attributes: value === 'cloudy' ? { temperature: 12, wind_speed: 8, pressure: 1015 } : {},
  last_changed: '2026-11-04T10:00:00Z',
  last_updated: '2026-11-04T10:00:00Z',
  context: {},
});

let forecastRequests: number;

beforeEach(() => {
  forecastRequests = 0;
  server.use(
    http.get(`${API_URL}/api/ha/forecast`, () => {
      forecastRequests += 1;
      return HttpResponse.json([
        { datetime: '2026-11-04T12:00:00Z', condition: 'cloudy', temperature: 13, templow: 6 },
      ]);
    }),
  );
});

const renderWeather = (value: string) =>
  render(<WeatherWidget entity={weather(value)} />, {
    wrapper: createQueryWrapper(createTestQueryClient()),
  });

describe('WeatherWidget availability', () => {
  it.each(['unavailable', 'unknown'])('shows a message when the entity is %s', async (value) => {
    renderWeather(value);

    expect(screen.getByText('Météo indisponible')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(forecastRequests).toBe(0);
  });

  it('shows the conditions and loads the forecasts when the entity is available', async () => {
    renderWeather('cloudy');

    expect(screen.queryByText('Météo indisponible')).not.toBeInTheDocument();
    expect(screen.getAllByText('Nuageux').length).toBeGreaterThan(0);
    await waitFor(() => expect(forecastRequests).toBe(2));
    expect(await screen.findByText("Aujourd'hui")).toBeInTheDocument();
  });
});
