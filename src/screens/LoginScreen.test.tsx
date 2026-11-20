/** LoginScreen tests — Google sign-in errors are shown in the page, not in a browser alert. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';

const oauth = vi.hoisted(() => ({ startOAuthFlow: vi.fn(async () => undefined) }));
vi.mock('../utils/test-auth', () => ({ useAppOAuth: () => oauth }));

describe('LoginScreen', () => {
  it('starts the Google sign-in with a redirect back to the app', async () => {
    render(<LoginScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter avec Google' }));
    expect(oauth.startOAuthFlow).toHaveBeenCalledWith({
      redirectUrl: `${window.location.origin}/`,
    });
  });

  it('shows a sign-in failure in the page', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    oauth.startOAuthFlow.mockRejectedValueOnce(new Error('Popup bloquée'));
    render(<LoginScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Se connecter avec Google' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Popup bloquée');
    expect(alert).not.toHaveBeenCalled();
  });

  it('shows the error passed by the app (expired session, refused access)', () => {
    render(<LoginScreen error="Session expirée. Veuillez vous reconnecter." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Session expirée');
  });

  it('shows a new sign-in failure over the message of the previous session', async () => {
    oauth.startOAuthFlow.mockRejectedValueOnce(new Error('Réseau indisponible'));
    render(<LoginScreen error="Session expirée. Veuillez vous reconnecter." />);

    await userEvent.click(screen.getByRole('button', { name: 'Se connecter avec Google' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Réseau indisponible');
  });
});
