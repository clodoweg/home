/** AlertsScreen tests — alerts listed and marked read on opening, links to widgets, push switch, dates. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { AlertsScreen, formatAlertTime } from './AlertsScreen';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null, isAdmin: true }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const LIST_URL = `${API_URL}/api/notifications`;

const ALERTS = [
  {
    id: 2,
    category: 'alarm',
    title: 'Alarme',
    body: 'Alarme activée\nMode absence',
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    read: false,
  },
  {
    id: 1,
    category: 'feeder',
    title: 'Croquettes',
    body: 'Bac vide',
    createdAt: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
    read: true,
  },
];

let reads: unknown[];

beforeEach(() => {
  reads = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  server.use(
    http.get(LIST_URL, () => HttpResponse.json({ notifications: ALERTS, unread: 1 })),
    http.post(`${API_URL}/api/notifications/read`, async ({ request }) => {
      reads.push(await request.json());
      return HttpResponse.json({ updated: 1 });
    }),
  );
});

afterEach(() => {
  Reflect.deleteProperty(window, 'Notification');
});

const renderScreen = (onClose = vi.fn()) =>
  render(<AlertsScreen onClose={onClose} />, {
    wrapper: createQueryWrapper(createTestQueryClient()),
  });

describe('AlertsScreen', () => {
  it('lists the alerts, keeps the new ones highlighted and marks them read', async () => {
    renderScreen();
    const fresh = await screen.findByTestId('alert-2');
    expect(fresh).toHaveAttribute('data-unread', 'true');
    expect(fresh).toHaveTextContent('Alarme (nouvelle)');
    expect(fresh).toHaveTextContent('il y a 5 min');
    expect(screen.getByTestId('alert-1')).not.toHaveAttribute('data-unread');
    await waitFor(() => expect(reads).toEqual([{}]));
    expect(screen.getByTestId('alert-2')).toHaveAttribute('data-unread', 'true');
  });

  it('opens the widget of an alert and closes the panel', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderScreen(onClose);
    const link = await screen.findByTestId('alert-1');
    expect(link).toHaveAttribute('href', '#animaux/feeder');
    await user.click(link);
    expect(onClose).toHaveBeenCalled();
  });

  it('says when there is no alert, without marking anything', async () => {
    server.use(http.get(LIST_URL, () => HttpResponse.json({ notifications: [], unread: 0 })));
    renderScreen();
    expect(await screen.findByTestId('alerts-empty')).toBeInTheDocument();
    expect(reads).toEqual([]);
  });

  it('explains why push is unavailable on this browser', async () => {
    renderScreen();
    expect(await screen.findByTestId('push-hint')).toHaveTextContent(/ne reçoit pas/);
    expect(screen.queryByTestId('push-toggle')).not.toBeInTheDocument();
  });
});

describe('formatAlertTime', () => {
  const now = new Date(2026, 10, 16, 12, 0);
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 10, day, hour, minute).toISOString();

  it.each([
    [new Date(2026, 10, 16, 11, 59, 30).toISOString(), "à l'instant"],
    [at(16, 11, 30), 'il y a 30 min'],
    [at(16, 9, 0), 'il y a 3 h'],
    [at(16, 1, 5), '01:05'],
    [at(15, 18, 4), 'hier 18:04'],
    [at(12, 18, 4), '12 nov. 18:04'],
  ])('%s → %s', (iso, label) => {
    expect(formatAlertTime(iso, now)).toBe(label);
  });
});
