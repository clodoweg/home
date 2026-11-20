/** API constants — backend location shared by the app and the service worker. */

/** Production backend, used when VITE_API_URL is not set. */
export const DEFAULT_API_URL = 'https://home-back.psaltery.org';

/**
 * Resolves the backend base URL from the build-time env.
 *
 * @param configured - Value of VITE_API_URL (may be empty).
 * @returns The configured URL, or the production backend.
 */
export const resolveApiUrl = (configured: string | undefined): string =>
  configured || DEFAULT_API_URL;
