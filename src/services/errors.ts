/**
 * API error primitives
 * Single source of truth for HTTP error construction across the API client.
 * Replaces the previous inline `new Error(...) + @ts-expect-error` pattern
 * that was duplicated in every fetch call (12+ occurrences).
 */

/**
 * Typed error thrown on any non-2xx API response.
 * Carries the HTTP status and the optional backend error code so consumers
 * can branch on specific failures (e.g. 401 → refresh token, 403 → redirect).
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Reads an error response body, extracting a structured `{ code, error?, message? }`
 * payload when present, and throws a typed `ApiError`. Must only be called when
 * `response.ok === false`.
 *
 * @param response - Fetch response whose body has not been consumed yet.
 * @throws ApiError populated with status, message, and optional backend code.
 */
export async function throwApiError(response: Response): Promise<never> {
  const errorText = await response.text();
  let code: string | undefined;
  let message: string;
  try {
    const parsed: unknown = JSON.parse(errorText);
    const body = (parsed !== null && typeof parsed === 'object' ? parsed : {}) as {
      code?: string;
      error?: string;
      message?: string;
    };
    if (body.code) code = body.code;
    // Some endpoints put the human message in `error`, others in `message`. A body that
    // parsed as JSON is never empty, so the raw text is a meaningful last resort.
    message = body.error || body.message || errorText;
  } catch {
    // Non-JSON body — fall back to raw text
    message = errorText || response.statusText;
  }
  throw new ApiError(response.status, `Error ${response.status}: ${message}`, code);
}

/**
 * Parses a successful JSON response or throws a typed ApiError on failure.
 * Most GET endpoints should funnel through this helper.
 *
 * @param response - Fetch response.
 * @returns Parsed JSON body typed as T.
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  return throwApiError(response);
}
