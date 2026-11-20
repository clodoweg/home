/** ThemeContext tests — theme read from the device, synced from the profile, applied to <html>, saved to the back and rolled back when the save fails. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { ThemeProvider, useTheme } from './ThemeContext';

const user = vi.hoisted(() => ({
  profile: null as { theme?: string } | null,
  token: 'jwt' as string | null,
}));

vi.mock('./UserContext', () => ({
  useUserProfile: () => user,
}));

const notifySaveFailure = vi.hoisted(() => vi.fn());
vi.mock('../lib/action-feedback', () => ({ notifySaveFailure }));

const THEME_KEY = 'app-theme-preference';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

/** Records every theme saved to the back. */
const mockSave = (status = 200) => {
  const saved: unknown[] = [];
  server.use(
    http.post(`${API_URL}/api/user/preferences`, async ({ request }) => {
      saved.push(await request.json());
      return status === 200
        ? HttpResponse.json({ ok: true })
        : HttpResponse.json({ error: 'nope' }, { status });
    }),
  );
  return saved;
};

const htmlClasses = () => Array.from(document.documentElement.classList);

beforeEach(() => {
  notifySaveFailure.mockClear();
  user.profile = null;
  user.token = 'jwt';
  document.documentElement.className = '';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('ThemeProvider', () => {
  it('defaults to dark and applies it to <html>', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
    expect(htmlClasses()).toEqual(['dark']);
  });

  it('restores the theme stored on the device', () => {
    localStorage.setItem(THEME_KEY, 'light');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
    expect(htmlClasses()).toEqual(['light']);
  });

  it('ignores an unknown stored value and an unreadable storage', () => {
    localStorage.setItem(THEME_KEY, 'sepia');
    const unknown = renderHook(() => useTheme(), { wrapper });
    expect(unknown.result.current.theme).toBe('dark');
    unknown.unmount();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const blocked = renderHook(() => useTheme(), { wrapper });
    expect(blocked.result.current.theme).toBe('dark');
  });

  it('follows the profile theme once, then lets the user change it', async () => {
    const saved = mockSave();
    user.profile = { theme: 'light' };
    const { result, rerender } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');

    await act(() => result.current.setTheme('dark'));
    // Profile reloaded (e.g. sign-in refresh): the already-synced theme is not re-applied.
    user.profile = null;
    rerender();
    user.profile = { theme: 'light' };
    rerender();

    expect(result.current.theme).toBe('dark');
    expect(saved).toEqual([{ theme: 'dark' }]);
  });

  it('ignores a profile without a valid theme', () => {
    localStorage.setItem(THEME_KEY, 'light');
    user.profile = { theme: 'blue' };
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
  });

  it('applies the profile theme even when the device storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    user.profile = { theme: 'light' };
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
  });

  it('toggles, stores and saves the theme', async () => {
    const saved = mockSave();
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.toggleTheme());
    await waitFor(() => expect(saved).toEqual([{ theme: 'light' }]));
    expect(result.current.theme).toBe('light');
    expect(htmlClasses()).toEqual(['light']);
    expect(localStorage.getItem(THEME_KEY)).toBe('light');

    act(() => result.current.toggleTheme());
    await waitFor(() => expect(saved).toEqual([{ theme: 'light' }, { theme: 'dark' }]));
  });

  it('does nothing when the theme is already active', async () => {
    const saved = mockSave();
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(() => result.current.setTheme('dark'));

    expect(saved).toEqual([]);
  });

  it('only stores the theme locally without a token', async () => {
    user.token = null;
    const saved = mockSave();
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(() => result.current.setTheme('light'));

    expect(saved).toEqual([]);
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('goes back to the previous theme and says so when the back refuses it', async () => {
    mockSave(500);
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(() => result.current.setTheme('light'));

    expect(result.current.theme).toBe('dark');
    expect(htmlClasses()).toEqual(['dark']);
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(notifySaveFailure).toHaveBeenCalledWith(expect.any(Error), 'le thème');
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      'Failed to save theme preference',
      expect.any(Error),
    );
  });
});

describe('useTheme', () => {
  it('throws outside of a ThemeProvider', () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within a ThemeProvider',
    );
  });
});
