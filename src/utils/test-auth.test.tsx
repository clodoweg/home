/** test-auth tests — Clerk hooks in a normal build, the simulated session in a VITE_TEST_MODE build. */
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({ isSignedIn: true, source: 'clerk' })),
  useUser: vi.fn(() => ({ user: { id: 'user_clerk' } })),
  useSignIn: vi.fn<() => unknown>(),
}));
vi.mock('@clerk/react', () => clerk);
vi.mock('@clerk/react/legacy', () => ({ useSignIn: clerk.useSignIn }));

const loadTestAuth = async (testMode: boolean) => {
  vi.resetModules();
  vi.doMock('./env', () => ({ isTestMode: testMode }));
  return import('./test-auth');
};

afterEach(() => {
  vi.doUnmock('./env');
});

describe('normal build', () => {
  it('uses the Clerk hooks', async () => {
    const auth = await loadTestAuth(false);
    expect(renderHook(() => auth.useAppAuth()).result.current).toMatchObject({ source: 'clerk' });
    expect(renderHook(() => auth.useAppUser()).result.current.user).toEqual({ id: 'user_clerk' });
  });

  it('starts the OAuth redirect once Clerk is ready', async () => {
    const authenticateWithRedirect = vi.fn(async () => undefined);
    clerk.useSignIn.mockReturnValue({
      isLoaded: true,
      signIn: { authenticateWithRedirect },
      setActive: vi.fn(),
    });
    const auth = await loadTestAuth(false);
    const { result } = renderHook(() => auth.useAppOAuth({ strategy: 'oauth_google' }));

    await act(async () => {
      await result.current.startOAuthFlow({ redirectUrl: 'https://home/x' });
    });

    expect(authenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: 'https://home/x',
      redirectUrlComplete: 'https://home/x',
    });
  });

  it('does nothing while Clerk is loading', async () => {
    clerk.useSignIn.mockReturnValue({ isLoaded: false, signIn: undefined, setActive: vi.fn() });
    const auth = await loadTestAuth(false);
    const { result } = renderHook(() => auth.useAppOAuth({ strategy: 'oauth_google' }));

    await expect(result.current.startOAuthFlow({ redirectUrl: '/' })).resolves.toBeUndefined();
  });
});

describe('VITE_TEST_MODE build', () => {
  it('signs a test user in and out through MockAuthProvider', async () => {
    const auth = await loadTestAuth(true);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <auth.MockAuthProvider>{children}</auth.MockAuthProvider>
    );
    const { result } = renderHook(() => ({ a: auth.useAppAuth(), u: auth.useAppUser() }), {
      wrapper,
    });

    expect(result.current.a.isSignedIn).toBe(true);
    expect(result.current.u.user).toMatchObject({ id: 'user_test' });
    await expect(result.current.a.getToken()).resolves.toMatch(/^eyJ/);

    await act(() => result.current.a.signOut());
    expect(result.current.a.isSignedIn).toBe(false);
  });

  it('falls back to a signed-in session outside the provider', async () => {
    const auth = await loadTestAuth(true);
    const { result } = renderHook(() => ({ a: auth.useAppAuth(), u: auth.useAppUser() }));

    expect(result.current.a.isSignedIn).toBe(true);
    await expect(result.current.a.getToken()).resolves.toMatch(/^eyJ/);
    await expect(result.current.a.signOut()).resolves.toBeUndefined();
    expect(result.current.u.user).toMatchObject({
      primaryEmailAddress: { emailAddress: 'test@home' },
    });
  });

  it('simulates the OAuth flow', async () => {
    const auth = await loadTestAuth(true);
    const { result } = renderHook(() => auth.useAppOAuth({ strategy: 'oauth_google' }));
    await expect(result.current.startOAuthFlow({ redirectUrl: '/' })).resolves.toBeUndefined();
  });
});
