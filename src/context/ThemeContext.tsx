/**
 * ThemeContext — Web theme manager (dark/light) using localStorage + Tailwind class; the
 * system's theme until the user chooses one.
 */
import React, {
  createContext,
  useCallback,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useUserProfile } from './UserContext';
import { updatePreferences } from '../services/api';
import { logger } from '../lib/logger';
import { notifySaveFailure } from '../lib/action-feedback';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app-theme-preference';

const readStoredTheme = (): Theme => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // No choice stored on this device (and none in the profile yet): follow the system.
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  } catch {
    // ignore
  }
  return 'dark';
};

const storeTheme = (theme: Theme) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing: the theme still applies, it is just not remembered on this device.
  }
};

/**
 * Manages light/dark theme, persists choice to localStorage, and syncs with
 * the backend user preference. Applies the theme class to `<html>` for Tailwind.
 *
 * @param children - React subtree that needs theme access.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, token } = useUserProfile();
  // Read before the first render: starting from 'dark' then switching meant a second render of
  // the whole app and a flash of the wrong theme.
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  // Read when saving: a token refresh must not change the context value (and re-render every
  // consumer of the theme).
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  });
  const lastSyncedProfileThemeRef = React.useRef<string | null>(null);

  // Class on <html> so Tailwind dark: variants work globally; set before the first paint.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (profile?.theme !== 'light' && profile?.theme !== 'dark') return;
    if (profile.theme === lastSyncedProfileThemeRef.current) return;
    lastSyncedProfileThemeRef.current = profile.theme;
    setTheme(profile.theme);
    storeTheme(profile.theme);
  }, [profile?.theme]);

  const saveTheme = useCallback(
    async (newTheme: Theme) => {
      if (newTheme === theme) return;
      const previousTheme = theme;
      setTheme(newTheme);
      storeTheme(newTheme);
      const activeToken = tokenRef.current;
      if (!activeToken) return;
      try {
        await updatePreferences(activeToken, { theme: newTheme });
      } catch (error) {
        // The account keeps the previous theme and would bring it back at the next profile load.
        logger.error('Failed to save theme preference', error);
        setTheme(previousTheme);
        storeTheme(previousTheme);
        notifySaveFailure(error, 'le thème');
      }
    },
    [theme],
  );

  const toggleTheme = useCallback(() => {
    saveTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, saveTheme]);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme: saveTheme }),
    [theme, toggleTheme, saveTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
};

/**
 * Returns the current theme and toggle/set helpers.
 * Must be used within ThemeProvider.
 */
export const useTheme = () => {
  const context = use(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
