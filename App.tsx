/**
 * App — Web entrypoint. Wires Clerk auth, theme, query and widget preferences around the
 * dashboard.
 */
import React, { useEffect, useState } from 'react';
import { ClerkProvider, ClerkLoading, ClerkLoaded } from '@clerk/react';
import { ClerkOfflineError } from '@clerk/react/errors';
import { LogOut } from 'lucide-react';

import './global.css';
import { useAppAuth, MockAuthProvider } from './src/utils/test-auth';
import { isTestMode, publishableKey } from './src/utils/env';
import { setOnUnauthorized } from './src/services/api';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { WidgetPreferencesProvider } from './src/context/WidgetPreferencesContext';
import { UserProvider, useUserProfile } from './src/context/UserContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { QueryProvider } from './src/context/QueryProvider';
import { Button } from './src/components/ui/Button';
import { Skeleton } from './src/components/ui/Skeleton';
import { ProfileGuard } from './src/components/ui/ProfileGuard';
import { Toaster } from './src/components/ui/Toaster';
import { LazyMotion } from 'motion/react';

function AuthGuard({
  children,
  setLoginError,
  loginError,
}: {
  children: React.ReactNode;
  setLoginError: (msg: string | null) => void;
  loginError: string | null;
}) {
  const { isSignedIn, signOut } = useAppAuth();
  const { profile, loading: profileLoading, profileError, refreshProfile } = useUserProfile();
  const isWaitingForProfile = isSignedIn && (profileLoading || !profile) && !loginError;

  useEffect(() => {
    if (profile && !loginError) setLoginError(null);
  }, [profile, loginError, setLoginError]);

  if (loginError) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-tile bg-card p-6">
          <p className="mb-2 text-center font-display text-2xl font-bold text-destructive">
            Accès refusé
          </p>
          <p className="mb-6 text-center text-base font-medium text-muted-foreground">
            {loginError}
          </p>
          <Button
            label="Déconnexion"
            variant="destructive"
            icon={LogOut}
            onClick={async () => {
              setLoginError(null);
              await signOut();
            }}
            className="w-full"
          />
        </div>
      </div>
    );
  }

  // First launch without a cached profile and the profile request failed: offer a retry
  // instead of waiting forever on the skeleton.
  if (isSignedIn && !profile && profileError && !loginError) {
    return <ProfileGuard loading={profileLoading} error={profileError} onRetry={refreshProfile} />;
  }

  if (isWaitingForProfile) {
    return (
      <div className="mx-auto grid min-h-screen w-full max-w-[1392px] flex-1 grid-cols-2 content-start gap-3 bg-background p-4 md:grid-cols-4 md:gap-4">
        <Skeleton className="col-span-full h-11 w-32 rounded-full" />
        <Skeleton className="col-span-2 h-40 rounded-tile md:h-56" />
        <Skeleton className="h-40 rounded-tile md:h-56" />
        <Skeleton className="h-40 rounded-tile md:h-56" />
        <Skeleton className="col-span-2 h-40 rounded-tile md:h-56" />
      </div>
    );
  }

  return <>{children}</>;
}

function AppContent({
  loginError,
  setLoginError,
}: {
  loginError: string | null;
  setLoginError: (msg: string | null) => void;
}) {
  const { signOut, getToken } = useAppAuth();

  useEffect(() => {
    setOnUnauthorized(async (message?: string, statusCode?: number) => {
      if (statusCode === 403) {
        let msg = message || "Accès refusé. Veuillez contacter l'administrateur.";
        const jsonStart = msg.indexOf('{');
        if (jsonStart !== -1) {
          try {
            const parsed = JSON.parse(msg.substring(jsonStart));
            msg = parsed.error || parsed.message || msg;
          } catch {
            void 0;
          }
        }
        setLoginError(msg);
      } else if (statusCode === 401) {
        try {
          const newToken = await getToken({ skipCache: true });
          if (newToken) return;
        } catch (error) {
          // Offline, Clerk cannot renew the token but the session is still valid: signing out
          // would only force a new login once the network is back.
          if (ClerkOfflineError.is(error)) return;
        }
        setLoginError('Session expirée. Veuillez vous reconnecter.');
        await signOut();
      }
    });
  }, [signOut, getToken, setLoginError]);

  return (
    <UserProvider>
      <ThemeProvider>
        <AppThemedContent loginError={loginError} setLoginError={setLoginError} />
      </ThemeProvider>
    </UserProvider>
  );
}

function AppThemedContent({
  loginError,
  setLoginError,
}: {
  loginError: string | null;
  setLoginError: (msg: string | null) => void;
}) {
  const { isSignedIn } = useAppAuth();
  const { user } = useUserProfile();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <Toaster />
      {!isSignedIn ? (
        <LoginScreen error={loginError} />
      ) : (
        <AuthGuard setLoginError={setLoginError} loginError={loginError}>
          {/* Keyed by user: an account switch restores (and persists) a separate cache. */}
          <QueryProvider key={user?.id ?? 'anonymous'}>
            <WidgetPreferencesProvider>
              <DashboardScreen />
            </WidgetPreferencesProvider>
          </QueryProvider>
        </AuthGuard>
      )}
    </div>
  );
}

const loadMotionFeatures = () =>
  import('./src/lib/motion-features').then((module) => module.default);

/**
 * Application root: Clerk, theme, query cache, user and preferences providers around the screens.
 *
 * @returns The app.
 */
export default function App() {
  const [loginError, setLoginError] = useState<string | null>(null);

  if (!publishableKey && !isTestMode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-5">
        <p className="mb-2 text-lg font-bold text-red-500">Configuration Error</p>
        <p className="text-slate-400">Missing VITE_CLERK_PUBLISHABLE_KEY.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* Animation features arrive after startup; `strict` forbids the full `motion` component,
          which would bring them back into the main bundle. */}
      <LazyMotion features={loadMotionFeatures} strict>
        {isTestMode ? (
          <MockAuthProvider>
            <AppContent loginError={loginError} setLoginError={setLoginError} />
          </MockAuthProvider>
        ) : (
          <ClerkProvider publishableKey={publishableKey!} telemetry={false}>
            <ClerkLoading>
              <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
                <div className="size-10 animate-spin rounded-full border-4 border-border border-t-primary" />
              </div>
            </ClerkLoading>
            <ClerkLoaded>
              <AppContent loginError={loginError} setLoginError={setLoginError} />
            </ClerkLoaded>
          </ClerkProvider>
        )}
      </LazyMotion>
    </ErrorBoundary>
  );
}
