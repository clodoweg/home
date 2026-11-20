/**
 * UserContext — Authentication and user profile state.
 * Wraps Clerk auth to expose a stable token, profile data, and permission flags.
 * Handles proactive token refresh (every 50 min), foreground-resume refresh,
 * and wires forceRefreshToken into the API client for 401 recovery.
 *
 * Performance: profile is cached in localStorage (stale-while-revalidate).
 * On return visits the cached profile is shown instantly while a background
 * refresh updates it. First launch falls back to a 5-second network timeout.
 */
import React, { createContext, use, useState, useEffect, useCallback, useRef } from 'react';
import {
  getUserProfile,
  setTokenProvider,
  setTokenRefreshHandler,
  type UserProfile as ApiUserProfile,
} from '../services/api';
import { hasPermission } from '../utils/permissions';
import { logger } from '../lib/logger';
import { useAppAuth, useAppUser, type AppUser } from '../utils/test-auth';
import { localStore } from '../utils/local-store';
import { claimDeviceForUser, isDeviceClaimed, purgeUserData } from '../lib/user-data';
import { queryClient } from '../lib/query-client';

const CACHED_PROFILE_KEY = 'hsh_cached_profile';
/** Maximum ms to wait for getUserProfile before giving up on a fresh load */
const PROFILE_FETCH_TIMEOUT_MS = 5_000;

/** Decode JWT exp claim without a library */
function isTokenExpiringSoon(jwt: string, marginMs = 30_000): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    return payload.exp * 1000 - Date.now() < marginMs;
  } catch {
    return true;
  }
}

/** Check if the underlying storage backend is functional. */
const isStorageAvailable = async () => {
  try {
    return await localStore.isAvailableAsync();
  } catch {
    return false;
  }
};

type UserProfile = ApiUserProfile;

interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  canAccessHistory: boolean;
  canAccessCameras: boolean;
  /**
   * Session token, set at sign-in and kept for the whole session: it gates requests and is their
   * fallback. Requests send Clerk's current token (setTokenProvider), so a renewal does not
   * change this value nor re-render its consumers.
   */
  token: string | null;
  /** Fetches a fresh token (e.g. after a 401) and returns it */
  refreshToken: () => Promise<string | null>;
  /** Signed-in Clerk user (null/undefined while loading or signed out). */
  user: AppUser | null | undefined;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/** Persist profile to localStorage for stale-while-revalidate on next launch. */
async function persistCachedProfile(profile: UserProfile): Promise<void> {
  try {
    // Signed out (or switched account) meanwhile: the purge must not be undone.
    if (!isDeviceClaimed()) return;
    const available = await isStorageAvailable();
    if (!available) return;
    await localStore.setItemAsync(CACHED_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    logger.warn('Failed to persist cached profile', e);
  }
}

/** Load the previously cached profile from localStorage. Returns null on any failure. */
async function loadCachedProfile(): Promise<UserProfile | null> {
  try {
    const available = await isStorageAvailable();
    if (!available) return null;
    const raw = await localStore.getItemAsync(CACHED_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Provides the Clerk session, the back profile and the derived rights to the tree.
 *
 * @param children - App subtree.
 * @returns The provider.
 */
export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { getToken, isSignedIn, isLoaded } = useAppAuth();
  const { user } = useAppUser();
  const userId: string | null = user?.id ?? null;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  // Bumped on every sign-out or account switch: a profile request started for a previous
  // session must not write its result into the new one.
  const sessionRef = useRef(0);
  // Clerk user the loaded profile belongs to.
  const profileOwnerRef = useRef<string | null>(null);
  // One profile request at a time (a retry also re-runs the sign-in effect).
  const profileRequestRef = useRef<Promise<void> | null>(null);
  const hasProfileRef = useRef(false);
  useEffect(() => {
    hasProfileRef.current = profile !== null;
  });
  const tokenRef = useRef<string | null>(null);

  // CRITICAL: Stable getToken reference via Ref
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // Keeps the first token of the session in state: a renewal only updates the ref.
  const publishToken = useCallback((t: string | null) => {
    tokenRef.current = t;
    setToken((previous) => (previous && t ? previous : t));
  }, []);

  /** Fetch (or refresh) the Clerk token and store it. */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      try {
        const currentGetToken = getTokenRef.current;
        let t = await currentGetToken();

        if (t && isTokenExpiringSoon(t)) {
          logger.warn('Token expiring soon, forcing cache skip…');
          t = await currentGetToken({ skipCache: true });
        }

        if (t && isTokenExpiringSoon(t, 5_000)) {
          logger.error('Clerk returned an already-expired token');
          return null;
        }

        publishToken(t);
        return t;
      } catch (e) {
        logger.error('Failed to refresh Clerk token', e);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [publishToken]);

  /** Force-refresh bypassing cache — use for 401 recovery */
  const forceRefreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      try {
        logger.info('Forcing Clerk token refresh (skipCache)…');
        const currentGetToken = getTokenRef.current;
        const t = await currentGetToken({ skipCache: true });
        publishToken(t);
        return t;
      } catch (e) {
        logger.error('Force token refresh failed', e);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [publishToken]);

  /**
   * Fetch user profile from backend with a 5-second timeout guard.
   * On success the result is persisted to localStorage for the next launch.
   */
  const loadProfile = useCallback(async () => {
    const session = sessionRef.current;
    try {
      setProfileError(null);
      // Nothing on screen yet (first launch or retry after a failure): show the loader.
      if (!hasProfileRef.current) setLoading(true);
      const t = tokenRef.current ?? (await refreshToken());
      if (!t) {
        logger.warn('No token available for profile refresh');
        setProfileError('Aucun jeton disponible pour charger le profil.');
        setLoading(false);
        return;
      }

      // Race the API call against a 5-second timeout so we never block forever; on timeout
      // the request itself is aborted, and the timer is always cleared.
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error('PROFILE_TIMEOUT'));
        }, PROFILE_FETCH_TIMEOUT_MS);
      });
      let data: Awaited<ReturnType<typeof getUserProfile>>;
      try {
        data = await Promise.race([getUserProfile(t, controller.signal), timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }
      if (sessionRef.current !== session) return;

      logger.info('User Profile Loaded:', data);
      setProfile((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
        return data as UserProfile;
      });
      // Persist for next launch (stale-while-revalidate)
      persistCachedProfile(data as UserProfile);
    } catch (error: unknown) {
      if (sessionRef.current !== session) return;
      logger.error('[UserContext] Profile refresh error:', error);

      let message = 'Impossible de charger votre profil.';
      const err = error as { message?: string; status?: number } | null;
      if (err?.message === 'PROFILE_TIMEOUT') {
        message = 'La vérification a pris trop de temps. Veuillez réessayer.';
        logger.warn('getUserProfile timed out after 5s');
      } else if (err?.message?.includes('quota') || err?.message?.includes('limite')) {
        message = "Quota de base de données dépassé. Veuillez contacter l'administrateur.";
      } else if (err?.status === 500) {
        message = 'Erreur serveur interne lors du chargement du profil.';
      } else if (err?.message) {
        message = err.message;
      }
      setProfileError(message);
    } finally {
      setLoading(false);
    }
  }, [refreshToken]);

  /** Loads the profile, sharing the request already in flight (a retry re-runs the sign-in effect). */
  const refreshProfile = useCallback((): Promise<void> => {
    if (!profileRequestRef.current) {
      profileRequestRef.current = loadProfile().finally(() => {
        profileRequestRef.current = null;
      });
    }
    return profileRequestRef.current;
  }, [loadProfile]);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      if (!userId) return;
      // Another account took over without a visible sign-out (e.g. a PWA frozen in the
      // background missed Clerk's sign-out): drop everything of the previous one.
      if (profileOwnerRef.current && profileOwnerRef.current !== userId) {
        sessionRef.current += 1;
        profileOwnerRef.current = null;
        void purgeUserData(queryClient);
        // The session token is kept for a whole session: the new account must publish its own.
        tokenRef.current = null;
        setToken(null);
        setProfile(null);
        setProfileError(null);
        setLoading(true);
        return;
      }
      if (!profile && !refreshPromiseRef.current && !profileRequestRef.current && !profileError) {
        setTokenRefreshHandler(forceRefreshToken);
        // Clerk's cache, never skipCache: Clerk renews its token before expiry, and bypassing
        // the cache here would cost one Clerk round-trip per request. A token refused anyway
        // goes through traceApi's single shared refresh.
        setTokenProvider(() => getTokenRef.current());
        // Before the cached profile (and later the query cache) is read: data left by
        // another account on this device must never be shown.
        claimDeviceForUser(userId);
        profileOwnerRef.current = userId;
        const session = sessionRef.current;

        // Stale-while-revalidate: show cached profile instantly, then refresh in background.
        loadCachedProfile().then((cached) => {
          if (sessionRef.current !== session) return;
          if (cached) {
            logger.info('[UserContext] Showing cached profile instantly');
            setProfile(cached);
            hasProfileRef.current = true;
            setLoading(false);
            // Background refresh — don't block UI
            refreshProfile();
          } else {
            // First launch: no cache, wait for network
            refreshProfile();
          }
        });
      }
    } else {
      sessionRef.current += 1;
      profileOwnerRef.current = null;
      setTokenRefreshHandler(null);
      setTokenProvider(null);
      // Clerk's session is the external source this effect follows: a sign-out resets the state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(null);
      tokenRef.current = null;
      setProfile(null);
      setProfileError(null);
      setLoading(false);
      // Signed out (logout button, expired session, other tab): nothing of this user may
      // stay on the device — query caches, cached profile, service worker API caches.
      void purgeUserData(queryClient);
    }
  }, [isLoaded, isSignedIn, userId, profile, refreshProfile, forceRefreshToken, profileError]);

  const value = React.useMemo(
    () => ({
      profile,
      loading,
      profileError,
      refreshProfile,
      isAdmin: profile?.group === 'admin',
      canAccessHistory: hasPermission(profile, 'history'),
      canAccessCameras: hasPermission(profile, 'cameras'),
      token,
      refreshToken,
      user,
    }),
    [profile, loading, profileError, token, user, refreshProfile, refreshToken],
  );

  return <UserContext value={value}>{children}</UserContext>;
};

/**
 * Hook to consume UserContext. Must be used inside UserProvider.
 *
 * @returns Auth state: token, profile, permission flags, and refresh helpers.
 * @throws If called outside of UserProvider.
 */
export const useUserProfile = () => {
  const context = use(UserContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProvider');
  }
  return context;
};
