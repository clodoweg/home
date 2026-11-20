/**
 * request — The single way to call the backend: bearer token, 401 retry (through traceApi),
 * timeout, cancellation, query encoding, JSON parsing and typed errors.
 *
 * WARNING: Security critical. The token only ever goes to API_URL, in the Authorization header.
 */
import { API_URL, currentSessionToken, traceApi } from './client';
import { throwApiError } from './errors';

/** Value of a query parameter; `undefined` drops the parameter. */
type QueryValue = string | number | boolean | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST';
  /** Encoded with URLSearchParams. */
  query?: Record<string, QueryValue>;
  /** Sent as JSON (sets Content-Type). */
  body?: unknown;
  /** Cancellation from the caller (React Query passes one to every query). */
  signal?: AbortSignal;
  /** Per attempt; the 401 retry gets a fresh delay. */
  timeoutMs?: number;
  /** How to read a successful response. */
  responseType?: 'json' | 'text' | 'none';
  /** Label used in the API logs. */
  name?: string;
}

/** A request that took longer than its timeout (no response, so no HTTP status). */
export class RequestTimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`${name} timed out after ${timeoutMs / 1000}s`);
    this.name = 'RequestTimeoutError';
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

const buildUrl = (path: string, query?: Record<string, QueryValue>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.append(key, String(value));
  }
  const search = params.toString();
  return `${API_URL}${path}${search ? `?${search}` : ''}`;
};

/**
 * Encodes one path segment taken from data (entity id, date…), so it cannot change the path.
 *
 * @param segment - Raw value.
 * @returns The value safe to put between two `/`.
 */
export const pathSegment = (segment: string): string => encodeURIComponent(segment);

/**
 * Calls the backend and returns the parsed body.
 *
 * @param token - Clerk session token of the caller.
 * @param path - Path under the backend origin, e.g. `/api/ha/states` (segments already encoded).
 * @param options - Method, query, JSON body, signal, timeout, response type, log label.
 * @returns The response body, typed by the caller.
 * @throws ApiError for a non-OK answer (after one refresh-and-retry on 401), RequestTimeoutError,
 *   the caller's AbortError, a network TypeError, or an Error when there is no token.
 */
export async function request<T>(
  token: string | null | undefined,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    query,
    body,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    responseType = 'json',
    name = `${method} ${path}`,
  } = options;
  const url = buildUrl(path, query);

  const attempt = async (requestId: string, activeToken: string): Promise<T> => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const forwardAbort = () => controller.abort();
    signal?.addEventListener('abort', forwardAbort);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${activeToken}`,
        'X-Request-Id': requestId,
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) return await throwApiError(response);
      if (responseType === 'none') return undefined as T;
      if (responseType === 'text') return (await response.text()) as T;
      return (await response.json()) as T;
    } catch (error) {
      if (timedOut) throw new RequestTimeoutError(name, timeoutMs);
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    }
  };

  const sessionToken = await currentSessionToken(token ?? null);
  return traceApi(
    name,
    async (requestId, currentToken) => {
      const activeToken = currentToken || sessionToken;
      if (!activeToken) throw new Error('No token');
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      return attempt(requestId, activeToken);
    },
    sessionToken ?? undefined,
  );
}
