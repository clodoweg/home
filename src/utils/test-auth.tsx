/**
 * test-auth — Auth hooks used by the app (`useAppAuth`, `useAppUser`, `useAppOAuth`).
 * They resolve to Clerk in production and to a simulated session in VITE_TEST_MODE
 * builds; `isTestMode` is a build-time constant, so the simulation is dropped from prod.
 */
import React, { ReactNode, createContext, use, useState, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/react';
// Core 3 keeps the v5 sign-in API here: the new signIn.sso() changes the redirect flow, which the
// mocked E2E cannot check.
import { useSignIn } from '@clerk/react/legacy';
import type { OAuthStrategy } from '@clerk/react/types';
import { isTestMode } from './env';
import { logger } from '../lib/logger';

/** Fields of the Clerk user the app reads (a Clerk `UserResource` fits this shape). */
export interface AppUser {
  id?: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: { emailAddress: string }[];
}

interface AuthContextType {
  signOut: () => Promise<void>;
  getToken: (options?: { skipCache?: boolean }) => Promise<string | null>;
  isSignedIn: boolean;
  isLoaded: boolean;
  user?: AppUser;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Simulated Clerk session for Playwright (VITE_TEST_MODE builds only).
 *
 * @param children - App subtree.
 * @returns The subtree with a signed-in test user.
 */
export const MockAuthProvider = ({ children }: { children: ReactNode }) => {
  const [isSignedIn, setIsSignedIn] = useState(true);

  const signOut = async () => {
    logger.info('Mock sign out triggering...');
    setIsSignedIn(false);
  };
  const getToken = async () =>
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX3Rlc3QiLCJlbWFpbCI6InRlc3RAaG9tZSIsImV4cCI6OTk5OTk5OTk5OX0.test';
  const isLoaded = true;
  const user = {
    id: 'user_test',
    emailAddresses: [{ emailAddress: 'test@home' }],
    firstName: 'Test',
    lastName: 'User',
    primaryEmailAddress: { emailAddress: 'test@home' },
  };

  return (
    <AuthContext value={{ signOut, getToken, isSignedIn, isLoaded, user }}>{children}</AuthContext>
  );
};

const useMockAuth = () => {
  const mockContext = use(AuthContext);

  if (!mockContext) {
    return {
      signOut: async () => {},
      getToken: async () =>
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX3Rlc3QiLCJlbWFpbCI6InRlc3RAaG9tZSIsImV4cCI6OTk5OTk5OTk5OX0.test',
      isSignedIn: true,
      isLoaded: true,
    };
  }
  return mockContext;
};

export const useAppAuth = isTestMode ? useMockAuth : useAuth;

const useMockUser = () => {
  const mockContext = use(AuthContext);

  if (!mockContext) {
    return {
      isLoaded: true,
      isSignedIn: true,
      user: { primaryEmailAddress: { emailAddress: 'test@home' } },
    };
  }
  return {
    isLoaded: mockContext.isLoaded,
    isSignedIn: mockContext.isSignedIn,
    user: mockContext.user,
  };
};

export const useAppUser = isTestMode ? useMockUser : useUser;

/**
 * OAuth sign-in hook exposing `startOAuthFlow({ redirectUrl })`.
 *
 * Clerk React has no `useOAuth` hook: OAuth on the web goes through
 * `signIn.authenticateWithRedirect()`, which navigates the browser to the
 * provider and back; Clerk then restores the session on its own.
 */
const useWebOAuth = ({ strategy }: { strategy: OAuthStrategy }) => {
  const { signIn, isLoaded } = useSignIn();

  const startOAuthFlow = useCallback(
    async ({ redirectUrl }: { redirectUrl: string }): Promise<void> => {
      if (!isLoaded || !signIn) return;
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl,
        redirectUrlComplete: redirectUrl,
      });
    },
    [isLoaded, signIn, strategy],
  );

  return { startOAuthFlow };
};

const mockOAuth = (_options: { strategy: OAuthStrategy }) => ({
  startOAuthFlow: async (_params: { redirectUrl: string }): Promise<void> => {
    logger.info('Mock OAuth flow started');
  },
});

export const useAppOAuth = isTestMode ? mockOAuth : useWebOAuth;
