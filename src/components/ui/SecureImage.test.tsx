/** SecureImage tests — the bearer token is only ever sent to the backend API; 401 retry, errors and cleanup. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/msw-server';
import { API_URL, isBackendApiUrl, setTokenProvider } from '../../services/client';
import { SecureImage } from './SecureImage';

const profile = vi.hoisted(() => ({
  token: 'jwt' as string | null,
  refreshToken: async (): Promise<string | null> => 'jwt-2',
}));

vi.mock('../../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const revokeObjectURL = vi.fn();

beforeEach(() => {
  profile.token = 'jwt';
  profile.refreshToken = async () => 'jwt-2';
  revokeObjectURL.mockReset();
  setTokenProvider(null);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:img', revokeObjectURL }));
});

describe('isBackendApiUrl', () => {
  it.each([`${API_URL}/api/ha/image/image.a`, '/api/ha/media?media_content_id=x'])(
    'accepts %s',
    (url) => expect(isBackendApiUrl(url)).toBe(true),
  );

  it.each([
    'https://cdn.example.com/api/img.png',
    `${API_URL}/other/path`,
    `${API_URL}.evil.example/api/x`,
    'http://[invalid',
  ])('rejects %s', (url) => expect(isBackendApiUrl(url)).toBe(false));
});

describe('SecureImage', () => {
  it('fetches a backend image with the bearer token', async () => {
    let authorization: string | null = null;
    server.use(
      http.get(`${API_URL}/api/ha/image/:id`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return new HttpResponse(new Blob(['png']), { headers: { 'Content-Type': 'image/png' } });
      }),
    );

    render(<SecureImage src={`${API_URL}/api/ha/image/image.a`} data-testid="img" />);

    await waitFor(() => expect(screen.getByTestId('img')).toHaveAttribute('src', 'blob:img'));
    expect(authorization).toBe('Bearer jwt');
  });

  it("P06: sends Clerk's current token rather than the session one kept in context", async () => {
    let authorization: string | null = null;
    server.use(
      http.get(`${API_URL}/api/ha/image/:id`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return new HttpResponse(new Blob(['png']), { headers: { 'Content-Type': 'image/png' } });
      }),
    );
    setTokenProvider(async () => 'jwt-current');

    render(<SecureImage src={`${API_URL}/api/ha/image/image.a`} data-testid="img" />);

    await waitFor(() => expect(screen.getByTestId('img')).toHaveAttribute('src', 'blob:img'));
    expect(authorization).toBe('Bearer jwt-current');
  });

  it('resolves a relative path against the backend, where the token is sent', async () => {
    let requestedUrl: string | undefined;
    server.use(
      http.get(`${API_URL}/api/ha/media`, ({ request }) => {
        requestedUrl = request.url;
        return new HttpResponse(new Blob(['png']), { headers: { 'Content-Type': 'image/png' } });
      }),
    );

    render(<SecureImage src="/api/ha/media?media_content_id=x" data-testid="img" />);

    await waitFor(() => expect(screen.getByTestId('img')).toBeInTheDocument());
    expect(requestedUrl).toBe(`${API_URL}/api/ha/media?media_content_id=x`);
  });

  it('refuses a third-party URL without sending any request', async () => {
    const onError = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<SecureImage src="https://cdn.example.com/photo.jpg" onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

const imageResponse = () =>
  new HttpResponse(new Blob(['png']), { headers: { 'Content-Type': 'image/png' } });

/** A fetch double whose blob is delivered only when the test releases it. */
const deferredImageFetch = () => {
  let releaseBlob: () => void = () => undefined;
  const blob = new Promise<Blob>((resolve) => {
    releaseBlob = () => resolve(new Blob(['png']));
  });
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({ status: 200, ok: true, blob: () => blob } as unknown as Response);
  return { fetchSpy, releaseBlob };
};

describe('SecureImage — rendering conditions', () => {
  it('renders nothing and fetches nothing without src', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { container } = render(<SecureImage src={undefined} />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('waits for a token before fetching', async () => {
    profile.token = null;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    server.use(http.get(`${API_URL}/api/ha/image/:id`, imageResponse));

    const { container, rerender } = render(
      <SecureImage src={`${API_URL}/api/ha/image/a`} data-testid="img" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(fetchSpy).not.toHaveBeenCalled();

    profile.token = 'jwt';
    rerender(<SecureImage src={`${API_URL}/api/ha/image/a`} data-testid="img" />);

    await waitFor(() => expect(screen.getByTestId('img')).toBeInTheDocument());
  });

  it('wraps the image in a div carrying className and style', async () => {
    server.use(http.get(`${API_URL}/api/ha/image/:id`, imageResponse));

    render(
      <SecureImage
        src={`${API_URL}/api/ha/image/a`}
        className="rounded-sm"
        style={{ opacity: 0.5 }}
        alt="Caméra"
        data-testid="img"
      />,
    );

    const img = await screen.findByTestId('img');
    expect(img).toHaveAttribute('alt', 'Caméra');
    expect(img).toHaveClass('size-full', 'object-cover');
    expect(img.parentElement).toHaveClass('rounded-sm');
    expect(img.parentElement).toHaveStyle({ opacity: '0.5' });
  });

  it('does not show the previous image while a new src loads', async () => {
    let releaseSecond: () => void = () => undefined;
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    server.use(
      http.get(`${API_URL}/api/ha/image/a`, imageResponse),
      http.get(`${API_URL}/api/ha/image/b`, async () => {
        await secondGate;
        return imageResponse();
      }),
    );

    const { rerender } = render(
      <SecureImage src={`${API_URL}/api/ha/image/a`} data-testid="img" />,
    );
    await screen.findByTestId('img');

    rerender(<SecureImage src={`${API_URL}/api/ha/image/b`} data-testid="img" />);
    expect(screen.queryByTestId('img')).not.toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:img');

    releaseSecond();
    await screen.findByTestId('img');
  });
});

describe('SecureImage — keepPrevious (camera refresh)', () => {
  it('keeps showing the previous image until the new one is loaded, then frees it', async () => {
    let blobs = 0;
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => `blob:img-${++blobs}`, revokeObjectURL }),
    );
    let releaseSecond: () => void = () => undefined;
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    server.use(
      http.get(`${API_URL}/api/ha/image/a`, imageResponse),
      http.get(`${API_URL}/api/ha/image/b`, async () => {
        await secondGate;
        return imageResponse();
      }),
    );

    const { rerender, unmount } = render(
      <SecureImage src={`${API_URL}/api/ha/image/a`} keepPrevious data-testid="img" />,
    );
    expect(await screen.findByTestId('img')).toHaveAttribute('src', 'blob:img-1');

    rerender(<SecureImage src={`${API_URL}/api/ha/image/b`} keepPrevious data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveAttribute('src', 'blob:img-1');
    expect(revokeObjectURL).not.toHaveBeenCalled();

    releaseSecond();
    await waitFor(() => expect(screen.getByTestId('img')).toHaveAttribute('src', 'blob:img-2'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:img-1');

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:img-2');
  });
});

describe('SecureImage — token handling', () => {
  it('retries once with a refreshed token after a 401', async () => {
    const authorizations: (string | null)[] = [];
    server.use(
      http.get(`${API_URL}/api/ha/image/:id`, ({ request }) => {
        authorizations.push(request.headers.get('Authorization'));
        return request.headers.get('Authorization') === 'Bearer jwt-2'
          ? imageResponse()
          : new HttpResponse(null, { status: 401 });
      }),
    );

    render(<SecureImage src={`${API_URL}/api/ha/image/a`} data-testid="img" />);

    await screen.findByTestId('img');
    expect(authorizations).toEqual(['Bearer jwt', 'Bearer jwt-2']);
  });

  it('reports an error when the retry is still refused, without a third attempt', async () => {
    const onError = vi.fn();
    let calls = 0;
    server.use(
      http.get(`${API_URL}/api/ha/image/:id`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    render(<SecureImage src={`${API_URL}/api/ha/image/a`} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toEqual(new Error('Image request failed: 401'));
    expect(calls).toBe(2);
  });

  it('does not retry when the refresh yields no token', async () => {
    profile.refreshToken = async () => null;
    const authorizations: (string | null)[] = [];
    server.use(
      http.get(`${API_URL}/api/ha/image/:id`, ({ request }) => {
        authorizations.push(request.headers.get('Authorization'));
        return new HttpResponse(null, { status: 401 });
      }),
    );
    const onError = vi.fn();

    render(<SecureImage src={`${API_URL}/api/ha/image/a`} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(authorizations).toEqual(['Bearer jwt']);
  });

  it('does not refetch when only the token value changes', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_URL}/api/ha/image/:id`, () => {
        calls += 1;
        return imageResponse();
      }),
    );
    const { rerender } = render(
      <SecureImage src={`${API_URL}/api/ha/image/a`} data-testid="img" />,
    );
    await screen.findByTestId('img');

    profile.token = 'jwt-rotated';
    rerender(<SecureImage src={`${API_URL}/api/ha/image/a`} data-testid="img" />);

    expect(screen.getByTestId('img')).toBeInTheDocument();
    expect(calls).toBe(1);
  });
});

describe('SecureImage — errors and cleanup', () => {
  it('reports a non-2xx answer through onError', async () => {
    const onError = vi.fn();
    server.use(
      http.get(`${API_URL}/api/ha/image/:id`, () => new HttpResponse(null, { status: 404 })),
    );

    const { container } = render(
      <SecureImage src={`${API_URL}/api/ha/image/a`} onError={onError} />,
    );

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(new Error('Image request failed: 404')),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('reports a network failure through onError', async () => {
    const onError = vi.fn();
    server.use(http.get(`${API_URL}/api/ha/image/:id`, () => HttpResponse.error()));

    render(<SecureImage src={`${API_URL}/api/ha/image/a`} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(TypeError)));
  });

  it('tolerates a failure without onError handler', async () => {
    server.use(
      http.get(`${API_URL}/api/ha/image/:id`, () => new HttpResponse(null, { status: 500 })),
    );
    const { container } = render(<SecureImage src={`${API_URL}/api/ha/image/a`} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('tolerates a third-party URL without onError handler', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<SecureImage src="https://cdn.example.com/photo.jpg" />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes a decoding error of the <img> to onError', async () => {
    const onError = vi.fn();
    server.use(http.get(`${API_URL}/api/ha/image/:id`, imageResponse));
    render(<SecureImage src={`${API_URL}/api/ha/image/a`} onError={onError} data-testid="img" />);

    fireEvent.error(await screen.findByTestId('img'));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toHaveProperty('type', 'error');
  });

  it('revokes the blob URL on unmount', async () => {
    server.use(http.get(`${API_URL}/api/ha/image/:id`, imageResponse));
    const { unmount } = render(<SecureImage src={`${API_URL}/api/ha/image/a`} data-testid="img" />);
    await screen.findByTestId('img');

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:img');
  });

  it('aborts the request and stays silent when unmounted before the answer', async () => {
    const onError = vi.fn();
    let signal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      signal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      );
    });

    const { unmount } = render(<SecureImage src={`${API_URL}/api/ha/image/a`} onError={onError} />);
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(signal?.aborted).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('drops a blob that arrives after unmount without creating a blob URL', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const onError = vi.fn();
    const { fetchSpy, releaseBlob } = deferredImageFetch();

    const { unmount } = render(<SecureImage src={`${API_URL}/api/ha/image/a`} onError={onError} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    unmount();
    await act(async () => {
      releaseBlob();
      await Promise.resolve();
    });

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
