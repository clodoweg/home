/** errors tests — ApiError shape and how error bodies become messages and codes. */
import { describe, expect, it } from 'vitest';
import { ApiError, handleResponse, throwApiError } from './errors';

const errorResponse = (body: string, status = 400, statusText = 'Bad Request') =>
  new Response(body, { status, statusText });

const captureApiError = async (response: Response): Promise<ApiError> => {
  try {
    await throwApiError(response);
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('throwApiError did not throw');
};

describe('ApiError', () => {
  it('carries the status, message and code', () => {
    const error = new ApiError(403, 'Error 403: no', 'IP_RESTRICTED');
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Error 403: no',
      code: 'IP_RESTRICTED',
    });
  });

  it('leaves the code undefined when absent', () => {
    expect(new ApiError(500, 'x').code).toBeUndefined();
  });
});

describe('throwApiError', () => {
  it('reads the backend envelope { error, details, code }', async () => {
    const error = await captureApiError(
      errorResponse(
        JSON.stringify({ error: 'Accès refusé', details: 'x', code: 'IP_RESTRICTED' }),
        403,
      ),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 403,
      message: 'Error 403: Accès refusé',
      code: 'IP_RESTRICTED',
    });
  });

  it('prefers `error` over `message`', async () => {
    const error = await captureApiError(
      errorResponse(JSON.stringify({ error: 'from error', message: 'from message' })),
    );
    expect(error.message).toBe('Error 400: from error');
  });

  it('falls back to `message`', async () => {
    const error = await captureApiError(errorResponse(JSON.stringify({ message: 'from message' })));
    expect(error.message).toBe('Error 400: from message');
    expect(error.code).toBeUndefined();
  });

  it('uses the raw JSON text when it has neither `error` nor `message`', async () => {
    const error = await captureApiError(errorResponse(JSON.stringify({ code: 'X', other: 1 })));
    expect(error.message).toBe('Error 400: {"code":"X","other":1}');
    expect(error.code).toBe('X');
  });

  it('uses the raw text of a non-JSON body', async () => {
    const error = await captureApiError(
      errorResponse('<html>Bad gateway</html>', 502, 'Bad Gateway'),
    );
    expect(error).toMatchObject({ status: 502, message: 'Error 502: <html>Bad gateway</html>' });
  });

  it('uses the status text of an empty body', async () => {
    const error = await captureApiError(errorResponse('', 500, 'Internal Server Error'));
    expect(error.message).toBe('Error 500: Internal Server Error');
  });

  it('uses the raw text of a JSON `null` body (reading its code throws, caught as non-JSON)', async () => {
    const error = await captureApiError(errorResponse('null', 500));
    expect(error.message).toBe('Error 500: null');
  });

  it('uses the raw text of a JSON scalar body', async () => {
    const error = await captureApiError(errorResponse('42', 500));
    expect(error.message).toBe('Error 500: 42');
  });
});

describe('handleResponse', () => {
  it('parses a successful JSON body', async () => {
    await expect(handleResponse<{ a: number }>(Response.json({ a: 1 }))).resolves.toEqual({ a: 1 });
  });

  it('throws an ApiError on failure', async () => {
    await expect(
      handleResponse(errorResponse(JSON.stringify({ error: 'nope', code: 'C' }), 404)),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Error 404: nope',
      code: 'C',
    });
  });
});
