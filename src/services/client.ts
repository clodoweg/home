/**
 * API Client Foundation
 * Core primitives shared by every backend call: URL, types, auth callbacks,
 * and the `traceApi` wrapper that handles logging + anti-stampede 401 refresh.
 *
 * WARNING: Security critical. Any changes to authentication or token handling
 * must be verified against the backend security policy.
 */
import { logger } from '../lib/logger';
import { apiUrl } from '../utils/env';

export const API_URL = apiUrl;

const API_ORIGIN = new URL(API_URL).origin;

/**
 * Tells whether a URL targets the backend API, the only place a bearer token may be sent.
 *
 * @param url - Absolute URL, or path relative to the backend.
 * @returns True for an `/api/` URL on the backend origin.
 */
export const isBackendApiUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url, API_URL);
    return parsed.origin === API_ORIGIN && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

/** Attributes read by the dashboard; any other attribute is `unknown` and must be checked. */
export interface HAAttributes {
  friendly_name?: string;
  unit_of_measurement?: string;
  device_class?: string;
  /** Members of a light group. */
  entity_id?: string[];
  brightness?: number;
  current_temperature?: number;
  temperature?: number;
  target_temperature?: number;
  target_temp_low?: number;
  target_temp_step?: number;
  min_temp?: number;
  max_temp?: number;
  hvac_modes?: string[];
  hvac_action?: string;
  /** Weather entities. */
  wind_speed?: number;
  pressure?: number;
  /** Aarlo cameras. */
  image_source?: string;
  last_thumbnail?: string;
  [attribute: string]: unknown;
}

export interface HAState {
  entity_id: string;
  state: string;
  attributes: HAAttributes;
  last_changed: string;
  last_updated: string;
  context: object;
}

export type SceneConfig = Record<string, { brightness: number | null }>;

let onUnauthorizedCallback: ((message?: string, statusCode?: number) => void) | null = null;
let tokenRefreshHandler: (() => Promise<string | null>) | null = null;
let tokenProvider: (() => Promise<string | null>) | null = null;
const TOKEN_PROVIDER_TIMEOUT_MS = 3_000;

/**
 * Installs (or removes, on sign-out) the function that returns the current session token. Clerk
 * session tokens are short-lived (60 s by default) and Clerk renews its cached one before expiry:
 * asking it before each request avoids sending an expired copy and paying a 401 + retry.
 *
 * @param provider - Returns the current token (Clerk's getToken), or null when signed out.
 */
export const setTokenProvider = (provider: (() => Promise<string | null>) | null) => {
  tokenProvider = provider;
};

/**
 * Token to send now: Clerk's current one, or the given fallback when Clerk has none, fails
 * (offline) or takes more than 3 s to answer.
 *
 * @param fallback - Token stored by the caller.
 * @returns The token to use, or null.
 */
export const currentSessionToken = async (fallback: string | null): Promise<string | null> => {
  if (!tokenProvider) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // A hung Clerk call must not hold the request: it runs before the request's own timeout.
  const tooSlow = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), TOKEN_PROVIDER_TIMEOUT_MS);
  });
  try {
    return (await Promise.race([tokenProvider(), tooSlow])) ?? fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Registers what to do when the back refuses the session (expired, outside home network, unknown user).
 *
 * @param callback - Receives the message to show and the HTTP status.
 * @returns Nothing.
 */
export const setOnUnauthorized = (callback: (message?: string, statusCode?: number) => void) => {
  onUnauthorizedCallback = callback;
};

/**
 * Installs (or removes, on sign-out) the function that force-refreshes the session token.
 * The shared refresh state is reset: a token refreshed for a previous session is never reused.
 *
 * @param handler - Force-refresh function, or null when signed out.
 */
export const setTokenRefreshHandler = (handler: (() => Promise<string | null>) | null) => {
  tokenRefreshHandler = handler;
  refreshInFlight = null;
  lastRefreshTime = 0;
  lastRefreshedToken = null;
};

// ─── Anti-stampede: shared refresh state ───────────────────────────────────────
// When multiple parallel calls all get 401, only the first triggers a token
// refresh. The others wait for the same promise and then retry with the fresh
// token. For 2 s after a successful refresh, a late 401 (a request sent with the
// old token just before) reuses that fresh token instead of refreshing again.
let refreshInFlight: Promise<string | null> | null = null;
let lastRefreshTime = 0;
let lastRefreshedToken: string | null = null;
const REFRESH_COOLDOWN_MS = 2_000;

const tokenAfterUnauthorized = async (): Promise<string | null> => {
  if (refreshInFlight) return refreshInFlight;
  if (Date.now() - lastRefreshTime <= REFRESH_COOLDOWN_MS) return lastRefreshedToken;
  refreshInFlight = tokenRefreshHandler!();
  try {
    const token = await refreshInFlight;
    // A refresh that yields nothing must not open the cooldown.
    if (token) {
      lastRefreshTime = Date.now();
      lastRefreshedToken = token;
    }
    return token;
  } finally {
    refreshInFlight = null;
  }
};

/** Status, code and message of whatever a request threw (ApiError, network TypeError…). */
const failureOf = (error: unknown): { status?: number; code?: string; message?: string } =>
  typeof error === 'object' && error !== null
    ? (error as { status?: number; code?: string; message?: string })
    : {};

/**
 * Central wrapper for every front → back API call.
 * - Adds logging (start / done / fail)
 * - Handles 401 retry with token refresh (deduplicated across parallel calls)
 * - Surfaces 401 / 403 to UI via onUnauthorizedCallback
 *
 * @param name - Label used in logs.
 * @param fn - The call; receives a request id and, on retry, the refreshed token.
 * @param originalToken - Token of the first attempt.
 * @returns The call's result; rejects with the last error (the retry's, if one ran).
 */
export const traceApi = async <T>(
  name: string,
  fn: (requestId: string, currentToken?: string) => Promise<T>,
  originalToken?: string,
): Promise<T> => {
  // eslint-disable-next-line sonarjs/pseudo-random -- log correlation id, not a secret
  const id = Math.random().toString(36).substring(7);
  const start = Date.now();

  logger.api.start(id, name);
  try {
    const result = await fn(id, originalToken);
    const duration = Date.now() - start;
    logger.api.done(id, name, duration);
    return result;
  } catch (firstError) {
    let error: unknown = firstError;
    // ── 401 retry with anti-stampede ──────────────────────────────────
    if (failureOf(error).status === 401 && tokenRefreshHandler) {
      logger.warn(`[API ${id}] ⛔️ 401 on ${name}. Waiting for token refresh…`);

      let newToken: string | null = null;
      try {
        newToken = await tokenAfterUnauthorized();
      } catch (refreshError) {
        logger.error(`[API ${id}] ❌ Token refresh failed`, refreshError);
      }

      if (newToken) {
        logger.info(`[API ${id}] 🔄 Retrying ${name} with fresh token…`);
        try {
          const result = await fn(id, newToken);
          const duration = Date.now() - start;
          logger.api.done(id, `${name} (retried)`, duration);
          return result;
        } catch (retryError) {
          // The retry's outcome is what the caller must see (e.g. a 500, not the stale 401).
          error = retryError;
        }
      }
    }

    // ── Surface error to UI ──────────────────────────────────────────
    const duration = Date.now() - start;
    logger.api.fail(id, name, duration, error);

    const failure = failureOf(error);
    if (failure.status === 401) {
      logger.warn(`[API ${id}] ⛔️ 401 persists after retry or no handler.`);
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback('Session expirée. Reconnexion en cours...', 401);
      }
    } else if (failure.status === 403) {
      let message = failure.message ?? '';
      let isGlobalAuthFailure = false;

      if (failure.code === 'IP_RESTRICTED' || failure.message?.includes('IP_RESTRICTED')) {
        message = "L'application doit être connectée au WIFI de la maison pour fonctionner";
        logger.warn(`[API ${id}] ⛔️ IP Restriction detected: ${message}`);
        isGlobalAuthFailure = true;
      } else if (
        failure.code === 'USER_NOT_FOUND' ||
        failure.message?.includes('Utilisateur non autorisé')
      ) {
        message = 'Utilisateur non autorisé';
        logger.warn(`[API ${id}] ⛔️ Unknown user detected.`);
        isGlobalAuthFailure = true;
      } else {
        logger.warn(`[API ${id}] ⛔️ Forbidden on ${name} — local handling.`);
      }

      if (isGlobalAuthFailure && onUnauthorizedCallback) {
        onUnauthorizedCallback(message, 403);
      }
    }
    throw error;
  }
};
