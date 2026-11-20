/**
 * SecureImage — Renders a remote image that requires Bearer auth.
 * `<img>` cannot send an Authorization header, so the image is fetched with it and
 * displayed from a blob URL. The JWT never goes in the URL: URLs end up in proxy logs,
 * browser history and Referer headers. The browser HTTP cache still applies
 * (the back answers with `Cache-Control: private, max-age=…`).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useUserProfile } from '../../context/UserContext';
import { API_URL, currentSessionToken, isBackendApiUrl } from '../../services/client';

interface SecureImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onError'
> {
  src: string | undefined;
  /** Called when the image cannot be fetched or decoded. */
  onError?: (error: unknown) => void;
  /**
   * Keep showing the previous image while a new `src` loads (a camera refreshing its snapshot).
   * Off by default: a previous image is never shown for an unrelated new src.
   */
  keepPrevious?: boolean;
}

/**
 * Displays an authenticated image.
 *
 * @param props - `src` (API URL), `onError`, `keepPrevious`, and the usual `<img>` attributes.
 * @returns The image wrapped in a div, or null while it is not available.
 */
export const SecureImage = ({
  src,
  className,
  style,
  onError,
  keepPrevious = false,
  ...props
}: SecureImageProps) => {
  const { token, refreshToken } = useUserProfile();
  // Tied to the src it was fetched for, so a previous image is only shown with keepPrevious
  const [loaded, setLoaded] = useState<{ src: string; blobUrl: string } | null>(null);
  // Blob URL currently displayed: freed once replaced or on unmount (never while on screen).
  const displayedBlobRef = useRef<string | null>(null);
  const keepPreviousRef = useRef(keepPrevious);

  // Read from a ref so a change of token never refetches the images; `hasToken` still
  // triggers the first fetch.
  const tokenRef = useRef(token);
  const refreshTokenRef = useRef(refreshToken);
  const onErrorRef = useRef(onError);
  const hasToken = Boolean(token);

  // Declared before the fetch effect so the refs are up to date when it runs
  useEffect(() => {
    tokenRef.current = token;
    refreshTokenRef.current = refreshToken;
    onErrorRef.current = onError;
    keepPreviousRef.current = keepPrevious;
  });

  useEffect(
    () => () => {
      if (displayedBlobRef.current) URL.revokeObjectURL(displayedBlobRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!src || !hasToken) return;
    // Resolved once, so the URL that is checked is exactly the URL that is fetched.
    const url = new URL(src, API_URL).href;
    // The token goes in the Authorization header: never send it outside the backend API.
    if (!isBackendApiUrl(url)) {
      onErrorRef.current?.(new Error('Refused to send credentials outside the backend API'));
      return;
    }

    const controller = new AbortController();

    const fetchImage = (activeToken: string | null) =>
      fetch(url, {
        headers: { Authorization: `Bearer ${activeToken}` },
        signal: controller.signal,
      });

    const load = async () => {
      // The context keeps the session's first token: ask Clerk for its current one.
      let response = await fetchImage(await currentSessionToken(tokenRef.current));
      // Clerk JWTs are short-lived: retry once with a fresh token, like the API client does
      if (response.status === 401) {
        const freshToken = await refreshTokenRef.current();
        if (freshToken) response = await fetchImage(freshToken);
      }
      if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const blobUrl = URL.createObjectURL(blob);
      const previous = displayedBlobRef.current;
      displayedBlobRef.current = blobUrl;
      setLoaded({ src, blobUrl });
      if (previous && previous !== blobUrl) URL.revokeObjectURL(previous);
    };

    load().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      onErrorRef.current?.(error);
    });

    return () => {
      controller.abort();
      // Without keepPrevious the old image is never shown again: free it right away.
      if (!keepPreviousRef.current && displayedBlobRef.current) {
        URL.revokeObjectURL(displayedBlobRef.current);
        displayedBlobRef.current = null;
      }
    };
  }, [src, hasToken]);

  if (!src || !loaded || (loaded.src !== src && !keepPrevious)) return null;

  return (
    <div className={className} style={style}>
      <img
        src={loaded.blobUrl}
        className="size-full object-cover"
        alt=""
        onError={onError}
        {...props}
      />
    </div>
  );
};
