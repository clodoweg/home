/** NotificationsScreen tests — stored settings shown, edited and saved; load and save failures explained. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { NotificationsScreen } from './NotificationsScreen';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const PREFERENCES_URL = `${API_URL}/api/user/preferences`;

const serveSettings = (
  settings: Record<string, unknown> = {
    notificationPreferences: { spa: false },
  },
) => server.use(http.get(PREFERENCES_URL, () => HttpResponse.json(settings)));

const renderScreen = () =>
  render(<NotificationsScreen />, { wrapper: createQueryWrapper(createTestQueryClient()) });

beforeEach(() => {
  profile.token = 'jwt';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('NotificationsScreen', () => {
  it('shows the stored categories', async () => {
    serveSettings();
    renderScreen();

    expect(await screen.findByRole('button', { name: /^Spa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Spa/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^Alarme/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves the edited settings', async () => {
    serveSettings({});
    const saved: unknown[] = [];
    server.use(
      http.post(PREFERENCES_URL, async ({ request }) => {
        saved.push(await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('button', { name: /^Alarme/ }));
    await user.click(screen.getByRole('button', { name: /^Alarme/ }));
    await user.click(screen.getByRole('button', { name: /^Spa/ }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Préférences enregistrées')).toBeInTheDocument();
    expect(saved).toEqual([{ notificationPreferences: { alarm: true, spa: false } }]);
  });

  it('says so when the save fails', async () => {
    serveSettings();
    server.use(
      http.post(PREFERENCES_URL, () => HttpResponse.json({ error: 'down' }, { status: 500 })),
    );
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Erreur lors de l'enregistrement");
    expect(screen.queryByText('Préférences enregistrées')).not.toBeInTheDocument();
  });

  it('offers to retry instead of an empty form when loading fails', async () => {
    let attempts = 0;
    server.use(
      http.get(PREFERENCES_URL, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ error: 'down' }, { status: 500 })
          : HttpResponse.json({ notificationPreferences: { spa: false } });
      }),
    );
    const user = userEvent.setup();
    renderScreen();

    expect(await screen.findByText('Impossible de charger les préférences.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Spa/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('button', { name: /^Spa/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('starts from fresh settings on a second visit, not from the cached copy', async () => {
    let spaEnabled = true;
    server.use(
      http.get(PREFERENCES_URL, () =>
        HttpResponse.json({ notificationPreferences: { spa: spaEnabled } }),
      ),
    );
    const client = createTestQueryClient();
    const first = render(<NotificationsScreen />, { wrapper: createQueryWrapper(client) });
    expect(await screen.findByRole('button', { name: /^Spa/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    first.unmount();

    spaEnabled = false;
    render(<NotificationsScreen />, { wrapper: createQueryWrapper(client) });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Spa/ })).toHaveAttribute('aria-pressed', 'false'),
    );
  });

  it('waits without a session', () => {
    profile.token = null;
    renderScreen();
    expect(screen.queryByRole('button', { name: /^Spa/ })).not.toBeInTheDocument();
  });
});
