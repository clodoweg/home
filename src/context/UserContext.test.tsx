/** UserContext tests — session data on the device (no token at rest, wiped at sign-out), Clerk token refresh, profile loading and access rights. */
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw-server';
import { API_URL, currentSessionToken } from '../services/client';
import { queryClient } from '../lib/query-client';
import { CACHE_OWNER_KEY } from '../lib/user-data';
import { localStore } from '../utils/local-store';
import { UserProvider, useUserProfile } from './UserContext';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.sig';
const auth = {
  isSignedIn: true,
  isLoaded: true,
  userId: 'user_a' as string | null,
  getToken: vi.fn(async (_options?: { skipCache?: boolean }): Promise<string | null> => TOKEN),
};

vi.mock('../utils/test-auth', () => ({
  useAppAuth: () => auth,
  useAppUser: () => ({ user: auth.isSignedIn && auth.userId ? { id: auth.userId } : null }),
}));

type RefreshHandler = (() => Promise<string | null>) | null;

/** Records the handler UserProvider registers for 401 recovery, and lets a test replace getUserProfile. */
const api = vi.hoisted(() => ({
  refreshHandler: null as (() => Promise<string | null>) | null,
  getUserProfile: null as ((token: string) => Promise<unknown>) | null,
}));

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    setTokenRefreshHandler: (handler: RefreshHandler) => {
      api.refreshHandler = handler;
      actual.setTokenRefreshHandler(handler);
    },
    getUserProfile: (token: string, signal?: AbortSignal) =>
      api.getUserProfile ? api.getUserProfile(token) : actual.getUserProfile(token, signal),
  };
});

const PROFILE = {
  email: 'a@home',
  group: 'admin',
  permissions: [],
  widgetPreferences: {},
  theme: 'dark',
};

const ProfileEmail = () => (
  <span data-testid="email">{useUserProfile().profile?.email ?? '-'}</span>
);

beforeEach(() => {
  auth.isSignedIn = true;
  auth.isLoaded = true;
  auth.userId = 'user_a';
  auth.getToken.mockReset();
  auth.getToken.mockImplementation(async () => TOKEN);
  api.refreshHandler = null;
  api.getUserProfile = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('caches', { keys: async () => [], delete: async () => true });
  server.use(http.get(`${API_URL}/api/user/me`, () => HttpResponse.json(PROFILE)));
});

describe('UserProvider', () => {
  it('never writes the session token to localStorage', async () => {
    render(
      <UserProvider>
        <ProfileEmail />
      </UserProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('a@home'));
    const stored = Object.values({ ...localStorage }).join('\n');
    expect(stored).not.toContain(TOKEN);
    expect(localStorage.getItem('hsh_background_token')).toBeNull();
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBe('user_a');
  });

  it('does not show a profile cached by another account', async () => {
    localStorage.setItem(CACHE_OWNER_KEY, 'user_b');
    localStorage.setItem('hsh_cached_profile', JSON.stringify({ ...PROFILE, email: 'b@home' }));
    let releaseProfile: () => void = () => {};
    server.use(
      http.get(`${API_URL}/api/user/me`, async () => {
        await new Promise<void>((resolve) => (releaseProfile = resolve));
        return HttpResponse.json(PROFILE);
      }),
    );

    render(
      <UserProvider>
        <ProfileEmail />
      </UserProvider>,
    );

    await waitFor(() => expect(localStorage.getItem(CACHE_OWNER_KEY)).toBe('user_a'));
    expect(screen.getByTestId('email')).toHaveTextContent('-');
    releaseProfile();
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('a@home'));
  });

  it('wipes the user data when the session ends', async () => {
    const { rerender } = render(
      <UserProvider>
        <ProfileEmail />
      </UserProvider>,
    );
    await waitFor(() => expect(localStorage.getItem('hsh_cached_profile')).not.toBeNull());
    queryClient.setQueryData(['ha', 'states'], [{ entity_id: 'light.salon' }]);
    localStorage.setItem('hsh-react-query-cache', '{"clientState":{}}');
    localStorage.setItem('app-theme-preference', 'light');

    auth.isSignedIn = false;
    rerender(
      <UserProvider>
        <ProfileEmail />
      </UserProvider>,
    );

    await waitFor(() => expect(localStorage.getItem('hsh_cached_profile')).toBeNull());
    expect(localStorage.getItem('hsh-react-query-cache')).toBeNull();
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBeNull();
    expect(localStorage.getItem('app-theme-preference')).toBe('light');
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(screen.getByTestId('email')).toHaveTextContent('-');
  });

  it('ignores a profile response that arrives after the sign-out', async () => {
    let releaseProfile: () => void = () => {};
    let requested = false;
    server.use(
      http.get(`${API_URL}/api/user/me`, async () => {
        requested = true;
        await new Promise<void>((resolve) => (releaseProfile = resolve));
        return HttpResponse.json(PROFILE);
      }),
    );
    const { rerender } = render(
      <UserProvider>
        <ProfileEmail />
      </UserProvider>,
    );
    await waitFor(() => expect(requested).toBe(true));

    auth.isSignedIn = false;
    rerender(
      <UserProvider>
        <ProfileEmail />
      </UserProvider>,
    );
    await waitFor(() => expect(localStorage.getItem(CACHE_OWNER_KEY)).toBeNull());
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    releaseProfile();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Not even transiently: the late response must neither be shown nor written.
    expect(writes).not.toHaveBeenCalledWith('hsh_cached_profile', expect.anything());
    expect(screen.getByTestId('email')).toHaveTextContent('-');
    expect(localStorage.getItem('hsh_cached_profile')).toBeNull();
  });

  it('wipes the previous account when another one takes over without a sign-out', async () => {
    const { rerender } = render(
      <UserProvider>
        <ProfileEmail />
      </UserProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('a@home'));
    queryClient.setQueryData(['ha', 'states'], [{ entity_id: 'light.salon' }]);
    server.use(
      http.get(`${API_URL}/api/user/me`, () => HttpResponse.json({ ...PROFILE, email: 'b@home' })),
    );

    auth.userId = 'user_b';
    rerender(
      <UserProvider>
        <ProfileEmail />
      </UserProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('b@home'));
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBe('user_b');
    expect(queryClient.getQueryData(['ha', 'states'])).toBeUndefined();
  });

  it("does not keep the previous account's token after a switch without sign-out", async () => {
    const { rerender } = renderProvider();
    await waitFor(() => expect(probeState().email).toBe('a@home'));
    server.use(
      http.get(`${API_URL}/api/user/me`, () => HttpResponse.json({ ...PROFILE, email: 'b@home' })),
    );
    const tokenB = jwtExpiringIn(3600);
    auth.getToken.mockImplementation(async () => tokenB);

    auth.userId = 'user_b';
    rerender(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );

    await waitFor(() => expect(probeState().email).toBe('b@home'));
    expect(probeState().token).toBe(tokenB);
  });
});

type UserContextValue = ReturnType<typeof useUserProfile>;

/** Builds an unsigned JWT whose `exp` is `secondsFromNow` away. */
const jwtExpiringIn = (secondsFromNow: number): string =>
  `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow }))}.sig`;

let current: UserContextValue | null = null;

const Probe = () => {
  const ctx = useUserProfile();
  useEffect(() => {
    current = ctx;
  });
  return (
    <pre data-testid="state">
      {JSON.stringify({
        email: ctx.profile?.email ?? null,
        loading: ctx.loading,
        profileError: ctx.profileError,
        isAdmin: ctx.isAdmin,
        canAccessHistory: ctx.canAccessHistory,
        canAccessCameras: ctx.canAccessCameras,
        token: ctx.token,
      })}
    </pre>
  );
};

type ProbeState = {
  email: string | null;
  loading: boolean;
  profileError: string | null;
  isAdmin: boolean;
  canAccessHistory: boolean;
  canAccessCameras: boolean;
  token: string | null;
};

const probeState = (): ProbeState =>
  JSON.parse(screen.getByTestId('state').textContent ?? '{}') as ProbeState;

const renderProvider = () =>
  render(
    <UserProvider>
      <Probe />
    </UserProvider>,
  );

/** Counts profile requests and records their Authorization header. */
const trackProfileRequests = (respond: () => Response | Promise<Response>) => {
  const calls: (string | null)[] = [];
  server.use(
    http.get(`${API_URL}/api/user/me`, async ({ request }) => {
      calls.push(request.headers.get('Authorization'));
      return respond();
    }),
  );
  return calls;
};

describe('UserProvider — startup', () => {
  it('waits for Clerk to load before doing anything', async () => {
    auth.isLoaded = false;
    const calls = trackProfileRequests(() => HttpResponse.json(PROFILE));
    const { rerender } = renderProvider();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(calls).toHaveLength(0);
    expect(probeState().loading).toBe(true);

    auth.isLoaded = true;
    rerender(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );
    await waitFor(() => expect(probeState().email).toBe('a@home'));
    expect(calls).toEqual([`Bearer ${TOKEN}`]);
    expect(probeState()).toMatchObject({ loading: false, profileError: null, token: TOKEN });
  });

  it('waits for the Clerk user while signed in', async () => {
    auth.userId = null;
    const calls = trackProfileRequests(() => HttpResponse.json(PROFILE));
    renderProvider();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(calls).toHaveLength(0);
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBeNull();
  });

  it('shows the cached profile of the same account at once, then refreshes it', async () => {
    localStorage.setItem(CACHE_OWNER_KEY, 'user_a');
    localStorage.setItem('hsh_cached_profile', JSON.stringify({ ...PROFILE, email: 'old@home' }));
    let releaseProfile: () => void = () => {};
    trackProfileRequests(async () => {
      await new Promise<void>((resolve) => (releaseProfile = resolve));
      return HttpResponse.json(PROFILE);
    });

    renderProvider();

    await waitFor(() => expect(probeState().email).toBe('old@home'));
    expect(probeState().loading).toBe(false);
    releaseProfile();
    await waitFor(() => expect(probeState().email).toBe('a@home'));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('hsh_cached_profile') ?? '{}').email).toBe('a@home'),
    );
  });

  it('keeps the same profile object when the refreshed profile is unchanged', async () => {
    localStorage.setItem(CACHE_OWNER_KEY, 'user_a');
    localStorage.setItem('hsh_cached_profile', JSON.stringify(PROFILE));
    const calls = trackProfileRequests(() => HttpResponse.json(PROFILE));

    renderProvider();
    await waitFor(() => expect(current?.profile?.email).toBe('a@home'));
    const cachedProfile = current?.profile;
    await waitFor(() => expect(calls).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(current?.profile).toBe(cachedProfile);
  });

  it('ignores an unreadable cached profile and waits for the network', async () => {
    localStorage.setItem(CACHE_OWNER_KEY, 'user_a');
    localStorage.setItem('hsh_cached_profile', '{not json');

    renderProvider();

    await waitFor(() => expect(probeState().email).toBe('a@home'));
  });

  it('works without a usable storage: nothing read, nothing persisted', async () => {
    vi.spyOn(localStore, 'isAvailableAsync').mockRejectedValue(new Error('denied'));

    renderProvider();

    await waitFor(() => expect(probeState().email).toBe('a@home'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(localStorage.getItem('hsh_cached_profile')).toBeNull();
  });

  it('skips the profile cache when storage reports itself unavailable', async () => {
    localStorage.setItem(CACHE_OWNER_KEY, 'user_a');
    localStorage.setItem('hsh_cached_profile', JSON.stringify({ ...PROFILE, email: 'old@home' }));
    const available = vi.spyOn(localStore, 'isAvailableAsync').mockResolvedValue(false);

    renderProvider();

    await waitFor(() => expect(probeState().email).toBe('a@home'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(available).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem('hsh_cached_profile') ?? '{}').email).toBe('old@home');
  });

  it('still shows the profile when persisting it fails', async () => {
    const write = vi.spyOn(localStore, 'setItemAsync').mockRejectedValue(new Error('full'));

    renderProvider();

    await waitFor(() => expect(probeState().email).toBe('a@home'));
    await waitFor(() => expect(write).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(console.warn).toHaveBeenCalledWith(
      expect.any(String),
      'Failed to persist cached profile',
      expect.any(Error),
    );
  });
  it('does not read the cache for a session that ended while the storage was opening', async () => {
    let openStorage: (available: boolean) => void = () => {};
    vi.spyOn(localStore, 'isAvailableAsync').mockImplementation(
      () => new Promise<boolean>((resolve) => (openStorage = resolve)),
    );
    const calls = trackProfileRequests(() => HttpResponse.json(PROFILE));
    const { rerender } = renderProvider();
    await waitFor(() => expect(localStore.isAvailableAsync).toHaveBeenCalled());

    auth.isSignedIn = false;
    rerender(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );
    await waitFor(() => expect(api.refreshHandler).toBeNull());
    await act(async () => openStorage(true));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(calls).toHaveLength(0);
    expect(probeState().email).toBeNull();
  });

  it('shows but does not persist a profile once the device lost its owner', async () => {
    let releaseProfile: () => void = () => {};
    const calls = trackProfileRequests(async () => {
      await new Promise<void>((resolve) => (releaseProfile = resolve));
      return HttpResponse.json(PROFILE);
    });
    renderProvider();
    await waitFor(() => expect(calls).toHaveLength(1));

    // Another tab signed out and purged the device meanwhile.
    localStorage.removeItem(CACHE_OWNER_KEY);
    releaseProfile();

    await waitFor(() => expect(probeState().email).toBe('a@home'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(localStorage.getItem('hsh_cached_profile')).toBeNull();
  });
});

describe('UserProvider — Clerk token', () => {
  it("B21: lets each request use Clerk's cached token, which Clerk renews itself", async () => {
    renderProvider();
    await waitFor(() => expect(probeState().email).toBe('a@home'));
    const expiringSoon = jwtExpiringIn(10);
    auth.getToken.mockClear();
    auth.getToken.mockImplementation(async () => expiringSoon);

    await expect(currentSessionToken('stored')).resolves.toBe(expiringSoon);
    expect(auth.getToken).not.toHaveBeenCalledWith({ skipCache: true });
  });

  it('forces a fresh token when the cached one expires within 30 s', async () => {
    const fresh = jwtExpiringIn(3600);
    auth.getToken.mockImplementation(async (options) =>
      options?.skipCache ? fresh : jwtExpiringIn(10),
    );
    const calls = trackProfileRequests(() => HttpResponse.json(PROFILE));

    renderProvider();

    await waitFor(() => expect(probeState().email).toBe('a@home'));
    expect(auth.getToken).toHaveBeenCalledWith({ skipCache: true });
    // The request itself takes Clerk's current token (still valid here), not the stored one.
    expect(calls).toHaveLength(1);
    expect(probeState().token).toBe(fresh);
  });

  it('treats an undecodable token as expiring', async () => {
    auth.getToken.mockImplementation(async (options) => (options?.skipCache ? TOKEN : 'garbage'));

    renderProvider();

    await waitFor(() => expect(probeState().email).toBe('a@home'));
    expect(auth.getToken).toHaveBeenCalledWith({ skipCache: true });
  });

  it.each([
    ['an already-expired token', async () => jwtExpiringIn(2)],
    ['no token', async () => null],
    [
      'a Clerk failure',
      async () => {
        throw new Error('clerk down');
      },
    ],
  ])('reports a missing token on %s, without calling the backend', async (_case, getToken) => {
    auth.getToken.mockImplementation(getToken);
    const calls = trackProfileRequests(() => HttpResponse.json(PROFILE));

    renderProvider();

    await waitFor(() =>
      expect(probeState().profileError).toBe('Aucun jeton disponible pour charger le profil.'),
    );
    expect(probeState()).toMatchObject({ loading: false, email: null, token: null });
    expect(calls).toHaveLength(0);
  });

  it('shares one Clerk call between concurrent refreshes', async () => {
    renderProvider();
    await waitFor(() => expect(probeState().email).toBe('a@home'));
    auth.getToken.mockClear();
    const next = jwtExpiringIn(3600);
    auth.getToken.mockImplementation(async () => next);

    let results: (string | null)[] = [];
    await act(async () => {
      results = await Promise.all([current!.refreshToken(), current!.refreshToken()]);
    });

    expect(results).toEqual([next, next]);
    expect(auth.getToken).toHaveBeenCalledTimes(1);
    expect(probeState().token).toBe(TOKEN);
  });

  it('P06: renews the token without changing the context value (no timer, no visibility refresh)', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    renderProvider();
    await waitFor(() => expect(probeState().email).toBe('a@home'));
    // The value compared below must be the settled one: captured while the profile was still
    // loading, it differed from the final value whatever the token renewal did (seen in CI).
    await waitFor(() => expect(current).toMatchObject({ loading: false, isAdmin: true }));
    const valueBefore = current;
    auth.getToken.mockClear();
    const next = jwtExpiringIn(3600);
    auth.getToken.mockImplementation(async () => next);

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(auth.getToken).not.toHaveBeenCalled();
    expect(setIntervalSpy.mock.calls.some(([, delay]) => delay === 50 * 60 * 1000)).toBe(false);

    let forced: string | null = null;
    await act(async () => {
      forced = await api.refreshHandler!();
    });
    expect(forced).toBe(next);
    expect(current).toBe(valueBefore);
    expect(probeState().token).toBe(TOKEN);
  });

  it('neither polls nor listens to visibility while signed out', async () => {
    auth.isSignedIn = false;
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    renderProvider();
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(setIntervalSpy.mock.calls.some(([, delay]) => delay === 50 * 60 * 1000)).toBe(false);
    expect(auth.getToken).not.toHaveBeenCalled();
    expect(probeState()).toMatchObject({ loading: false, token: null, email: null });
  });
});

describe('UserProvider — 401 recovery handler', () => {
  it('registers a force-refresh handler at sign-in and removes it at sign-out', async () => {
    const { rerender } = renderProvider();
    await waitFor(() => expect(probeState().email).toBe('a@home'));
    expect(api.refreshHandler).toBeTypeOf('function');

    const forced = jwtExpiringIn(3600);
    auth.getToken.mockClear();
    auth.getToken.mockImplementation(async () => forced);
    let result: string | null = null;
    await act(async () => {
      result = await api.refreshHandler!();
    });

    expect(result).toBe(forced);
    expect(auth.getToken).toHaveBeenCalledWith({ skipCache: true });
    expect(probeState().token).toBe(TOKEN);

    auth.isSignedIn = false;
    rerender(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );
    await waitFor(() => expect(api.refreshHandler).toBeNull());
  });

  it('returns null when the forced refresh fails', async () => {
    renderProvider();
    await waitFor(() => expect(probeState().email).toBe('a@home'));
    auth.getToken.mockRejectedValue(new Error('clerk down'));

    let result: string | null = 'unset';
    await act(async () => {
      result = await api.refreshHandler!();
    });

    expect(result).toBeNull();
    expect(probeState().token).toBe(TOKEN);
  });

  it('joins a refresh already in flight instead of starting another', async () => {
    renderProvider();
    await waitFor(() => expect(probeState().email).toBe('a@home'));
    auth.getToken.mockClear();
    let releaseToken: (token: string) => void = () => {};
    auth.getToken.mockImplementation(
      () => new Promise<string>((resolve) => (releaseToken = resolve)),
    );

    let results: (string | null)[] = [];
    await act(async () => {
      const pending = Promise.all([
        current!.refreshToken(),
        api.refreshHandler!(),
        api.refreshHandler!(),
      ]);
      releaseToken(TOKEN);
      results = await pending;
    });

    expect(results).toEqual([TOKEN, TOKEN, TOKEN]);
    expect(auth.getToken).toHaveBeenCalledTimes(1);
    expect(auth.getToken).toHaveBeenCalledWith();
  });

  it('lets the API client retry a 401 profile request with a forced token', async () => {
    const forced = jwtExpiringIn(3600);
    auth.getToken.mockImplementation(async (options) => (options?.skipCache ? forced : TOKEN));
    const calls = trackProfileRequests(() => HttpResponse.json(PROFILE));
    server.use(
      http.get(
        `${API_URL}/api/user/me`,
        () => HttpResponse.json({ error: 'expired' }, { status: 401 }),
        { once: true },
      ),
    );

    renderProvider();

    await waitFor(() => expect(probeState().email).toBe('a@home'));
    expect(calls).toEqual([`Bearer ${forced}`]);
    expect(probeState().token).toBe(TOKEN);
  });
});

describe('UserProvider — profile errors', () => {
  it.each([
    [
      500,
      'Database quota exceeded',
      "Quota de base de données dépassé. Veuillez contacter l'administrateur.",
    ],
    [
      429,
      'limite atteinte',
      "Quota de base de données dépassé. Veuillez contacter l'administrateur.",
    ],
    [500, 'boom', 'Erreur serveur interne lors du chargement du profil.'],
    [404, 'Not here', 'Error 404: Not here'],
  ])('maps a %i "%s" response to "%s"', async (status, error, message) => {
    trackProfileRequests(() => HttpResponse.json({ error }, { status }));

    renderProvider();

    await waitFor(() => expect(probeState().profileError).toBe(message));
    expect(probeState()).toMatchObject({ loading: false, email: null });
  });

  it('falls back to a generic message for an error without a message', async () => {
    api.getUserProfile = async () => {
      throw null;
    };

    renderProvider();

    await waitFor(() =>
      expect(probeState().profileError).toBe('Impossible de charger votre profil.'),
    );
  });

  it('clears its 5-second timer when the profile arrives', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    renderProvider();
    await waitFor(() => expect(probeState().email).toBe('a@home'));
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('gives up after 5 seconds and aborts the request', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    let releaseProfile: () => void = () => {};
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    trackProfileRequests(async () => {
      await new Promise<void>((resolve) => (releaseProfile = resolve));
      return HttpResponse.json(PROFILE);
    });
    renderProvider();
    await waitFor(() =>
      expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 5_000)).toBe(true),
    );
    const timeout = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 5_000)!;

    await act(async () => {
      (timeout[0] as () => void)();
    });

    expect(probeState()).toMatchObject({
      profileError: 'La vérification a pris trop de temps. Veuillez réessayer.',
      loading: false,
      email: null,
    });
    const profileCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/api/user/me'));
    expect(profileCall?.[1]?.signal?.aborted).toBe(true);
    releaseProfile();
  });

  it('drops an error that arrives after the sign-out', async () => {
    let releaseProfile: () => void = () => {};
    const calls = trackProfileRequests(async () => {
      await new Promise<void>((resolve) => (releaseProfile = resolve));
      return HttpResponse.json({ error: 'boom' }, { status: 500 });
    });
    const { rerender } = renderProvider();
    await waitFor(() => expect(calls).toHaveLength(1));

    auth.isSignedIn = false;
    rerender(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );
    await waitFor(() => expect(api.refreshHandler).toBeNull());
    releaseProfile();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(probeState().profileError).toBeNull();
  });

  it('can be retried by hand through refreshProfile, reusing the current token', async () => {
    let failing = true;
    const calls = trackProfileRequests(() =>
      failing ? HttpResponse.json({ error: 'boom' }, { status: 500 }) : HttpResponse.json(PROFILE),
    );
    renderProvider();
    await waitFor(() => expect(probeState().profileError).not.toBeNull());
    auth.getToken.mockClear();

    failing = false;
    await act(async () => {
      await current!.refreshProfile();
    });

    expect(probeState()).toMatchObject({ email: 'a@home', profileError: null });
    expect(calls).toHaveLength(2);
    // Clerk's cached token is read for the request, but no forced renewal happens.
    expect(auth.getToken).not.toHaveBeenCalledWith({ skipCache: true });
  });

  it('does not retry on its own after a first-launch failure', async () => {
    const calls = trackProfileRequests(() => HttpResponse.json({ error: 'boom' }, { status: 500 }));
    const { rerender } = renderProvider();
    await waitFor(() => expect(probeState().profileError).not.toBeNull());

    rerender(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    // No automatic retry loop: the user retries from the error screen (AuthGuard, B04).
    expect(calls).toHaveLength(1);
    expect(probeState()).toMatchObject({ email: null, loading: false });
  });
});

describe('UserProvider — access rights', () => {
  it.each([
    ['admin without permission list', { group: 'admin' }, [true, true, true]],
    ['user without permission list', { group: 'user' }, [false, false, false]],
    ['children without permission list', { group: 'children' }, [false, false, false]],
    [
      'children granted history',
      { group: 'children', permissions: ['history'] },
      [false, true, false],
    ],
    [
      'user granted cameras only',
      { group: 'user', permissions: ['cameras'] },
      [false, false, true],
    ],
  ])('%s', async (_case, overrides, [isAdmin, history, cameras]) => {
    // Serialized without the permission list (undefined is dropped by JSON).
    const base = { ...PROFILE, permissions: undefined };
    server.use(
      http.get(`${API_URL}/api/user/me`, () => HttpResponse.json({ ...base, ...overrides })),
    );

    renderProvider();

    await waitFor(() => expect(probeState().email).toBe('a@home'));
    expect(probeState()).toMatchObject({
      isAdmin,
      canAccessHistory: history,
      canAccessCameras: cameras,
    });
  });

  it('grants nothing before the profile is loaded', () => {
    auth.isLoaded = false;
    renderProvider();
    expect(probeState()).toMatchObject({
      isAdmin: false,
      canAccessHistory: false,
      canAccessCameras: false,
    });
  });
});

describe('useUserProfile', () => {
  it('throws outside of a UserProvider', () => {
    expect(() => renderHook(() => useUserProfile())).toThrow(
      'useUserProfile must be used within a UserProvider',
    );
  });
});

describe('fixed bugs (regressions)', () => {
  it('B04: a manual retry after a first-launch failure loads the profile, with one request', async () => {
    let fail = true;
    const calls = trackProfileRequests(() =>
      fail ? HttpResponse.json({ error: 'boom' }, { status: 500 }) : HttpResponse.json(PROFILE),
    );
    renderProvider();
    await waitFor(() => expect(probeState().profileError).not.toBeNull());
    expect(calls).toHaveLength(1);

    fail = false;
    let retry: Promise<void> | undefined;
    act(() => {
      retry = current!.refreshProfile();
    });
    // The retry screen shows its spinner while the profile loads.
    await waitFor(() => expect(probeState().loading).toBe(true));
    await act(() => retry!);

    await waitFor(() => expect(probeState().email).toBe('a@home'));
    expect(probeState().profileError).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toHaveLength(2);
  });

  it('B19: an admin with an empty permission list keeps the rights of the group, as on the back', async () => {
    renderProvider();
    await waitFor(() => expect(probeState().email).toBe('a@home'));

    expect(probeState()).toMatchObject({ canAccessHistory: true, canAccessCameras: true });
  });
});
