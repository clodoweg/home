/** ThresholdsTab tests — with the real preferences context: edits survive a failed save, admin checks keep their order. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../../services/client';
import { server } from '../../test/msw-server';
import { WidgetPreferencesProvider } from '../../context/WidgetPreferencesContext';
import { ThresholdsTab } from './ThresholdsTab';

const user = vi.hoisted(() => ({
  token: 'jwt' as string | null,
  profile: { widgetPreferences: {} } as { widgetPreferences: unknown },
  isAdmin: false,
}));

vi.mock('../../context/UserContext', () => ({ useUserProfile: () => user }));
vi.mock('../../lib/action-feedback', () => ({ notifySaveFailure: vi.fn() }));

const renderTab = () =>
  render(
    <WidgetPreferencesProvider>
      <ThresholdsTab />
    </WidgetPreferencesProvider>,
  );

const save = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder les seuils|Sauvegarde/ }));
  });

beforeEach(() => {
  user.isAdmin = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ThresholdsTab', () => {
  it('keeps the typed values when the save fails, so it can be retried', async () => {
    server.use(
      http.post(`${API_URL}/api/user/preferences`, () =>
        HttpResponse.json({ error: 'down' }, { status: 500 }),
      ),
    );
    renderTab();
    const indoorMinRed = screen.getAllByLabelText('Rouge Min (°C)')[0];

    fireEvent.change(indoorMinRed, { target: { value: '12' } });
    await save();

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Erreur lors de la sauvegarde.'),
    );
    expect(indoorMinRed).toHaveValue(12);
  });

  it('checks the temperature pair before the humidity ranges', async () => {
    user.isAdmin = true;
    renderTab();

    fireEvent.change(screen.getByTestId('input-alert-temp-min'), { target: { value: '40' } });
    fireEvent.change(screen.getByTestId('input-alert-hum-min'), { target: { value: '120' } });
    await save();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Alertes Température : Le seuil minimal doit être inférieur au seuil maximal.',
    );
  });
});
