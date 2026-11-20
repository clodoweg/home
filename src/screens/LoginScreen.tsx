/**
 * LoginScreen — Sign-in screen: brand tile and Google OAuth via the Clerk web SDK.
 */
import React, { useState } from 'react';
import { useAppOAuth } from '../utils/test-auth';
import { Button } from '../components/ui/Button';
import { logger } from '../lib/logger';

/**
 * Sign-in screen (Google through Clerk).
 *
 * @returns The screen.
 */
export const LoginScreen = ({ error }: { error?: string | null }) => {
  const { startOAuthFlow } = useAppOAuth({ strategy: 'oauth_google' });
  const [oauthError, setOauthError] = useState<string | null>(null);
  // A fresh sign-in failure matters more than the message that led back to this screen.
  const shownError = oauthError ?? error;

  const onSignInPress = async () => {
    setOauthError(null);
    try {
      // Leaves the page for Google; Clerk restores the session when it comes back.
      await startOAuthFlow({ redirectUrl: window.location.origin + '/' });
    } catch (err) {
      logger.error('OAuth error', err);
      setOauthError(
        (err as Error)?.message || 'Une erreur est survenue lors de la connexion avec Google.',
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-[420px] flex-col gap-3">
        <div className="flex min-h-64 flex-col justify-between gap-10 rounded-tile bg-sun p-7 text-ink">
          <img src="/icon-192.png" alt="" className="size-14 rounded-2xl object-contain" />
          <div>
            <h1 className="font-display text-5xl leading-none font-bold tracking-tight">
              Home Sweet Home
            </h1>
            <p className="mt-3 text-sm font-medium">Lumières, climat, énergie, sécurité.</p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4 rounded-tile bg-card p-5">
          {shownError && (
            <div role="alert" className="rounded-2xl bg-destructive/15 p-3">
              <p className="text-center font-medium text-destructive">{shownError}</p>
            </div>
          )}
          <Button
            label="Se connecter avec Google"
            variant="default"
            onClick={onSignInPress}
            size="lg"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};
