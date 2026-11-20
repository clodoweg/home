/**
 * AppHeader — Top bar of the app: brand, section pills (computer), last update, the light / dark
 * switch, the alerts bell (admins) and the settings button, plus the Home Assistant error banner.
 */
import React from 'react';
import { Bell, RefreshCw, Settings2 } from 'lucide-react';

import type { Section, SectionId } from '../../constants/sections';
import { Button } from './Button';
import { SectionNav } from './SectionNav';
import { ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  sections: readonly Section[];
  section: SectionId;
  lastUpdated: Date | null;
  isFetching?: boolean;
  haError: unknown;
  menuOpen: boolean;
  isMobile: boolean;
  onOpenMenu: () => void;
  /** Opens the alerts panel; without it (non-admins) there is no bell. */
  onOpenAlerts?: () => void;
  /** Unread alerts, shown as a badge on the bell. */
  unreadAlerts?: number;
}

/**
 * Top bar: brand, sections, last update, theme switch, alerts bell, settings button and error
 * banner.
 *
 * @param props - Sections, header state, the settings and alerts callbacks, the unread count.
 * @returns The header.
 */
export const AppHeader = ({
  sections,
  section,
  lastUpdated,
  isFetching = false,
  haError,
  menuOpen,
  isMobile,
  onOpenMenu,
  onOpenAlerts,
  unreadAlerts = 0,
}: AppHeaderProps) => {
  const errorMessage =
    haError && typeof haError === 'object' && 'message' in haError
      ? String((haError as { message?: unknown }).message)
      : null;

  return (
    <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1392px] flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a
          href="#accueil"
          className="rounded-lg font-display text-2xl font-bold tracking-tight text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          Home
        </a>
        {!isMobile && <SectionNav sections={sections} current={section} variant="pills" />}
        <div className="flex flex-row items-center gap-3">
          {lastUpdated && (
            <p
              data-testid="last-updated"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              {isFetching && <RefreshCw aria-hidden="true" className="size-3 animate-spin" />}
              <span>
                MAJ{' '}
                {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          )}
          <ThemeToggle />
          {onOpenAlerts && (
            <span className="relative">
              <Button
                data-testid="alerts-button"
                aria-label={
                  unreadAlerts > 0
                    ? `Alertes, ${unreadAlerts} ${unreadAlerts > 1 ? 'nouvelles' : 'nouvelle'}`
                    : 'Alertes'
                }
                icon={Bell}
                variant="secondary"
                size="icon"
                onClick={onOpenAlerts}
              />
              {unreadAlerts > 0 && (
                <span
                  data-testid="alerts-badge"
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] leading-none font-bold text-destructive-foreground"
                >
                  {unreadAlerts > 99 ? '99+' : unreadAlerts}
                </span>
              )}
            </span>
          )}
          <Button
            data-testid="menu-button"
            aria-label="Ouvrir les réglages"
            aria-expanded={menuOpen}
            icon={Settings2}
            variant="secondary"
            size="icon"
            onClick={onOpenMenu}
          />
        </div>
      </div>

      {errorMessage && (
        <div className="mx-auto w-full max-w-[1392px] px-4 pb-3 sm:px-6">
          <p
            role="alert"
            className="rounded-2xl bg-destructive/15 p-4 text-center font-semibold text-destructive"
          >
            {errorMessage}
          </p>
        </div>
      )}
    </header>
  );
};
