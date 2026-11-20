/**
 * NavigationMenu — Settings shown in the overlay: refresh, auto-refresh, customization,
 * notifications and logout, as a grid of tiles (two columns on a phone, three on a computer).
 */
import React from 'react';
import { Bell, Hand, LogOut, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppAuth } from '../../utils/test-auth';
import { cn } from '../../lib/utils';

interface NavigationMenuProps {
  onClose: () => void;
  onRefresh?: () => void;
  autoRefresh?: boolean;
  onToggleAutoRefresh?: (value: boolean) => void;
  onNavigate?: (screen: 'dashboard' | 'reorder' | 'notifications') => void;
  canAccessNotifications?: boolean;
}

/**
 * Settings menu: refresh, customization shortcuts and logout (the theme is in the header).
 *
 * @param props - Navigation and logout callbacks.
 * @returns The menu.
 */
export const NavigationMenu = ({
  onClose,
  onRefresh,
  autoRefresh,
  onToggleAutoRefresh,
  onNavigate,
  canAccessNotifications = false,
}: NavigationMenuProps) => {
  const { signOut } = useAppAuth();

  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-6">
      <MenuOption
        testID="menu-item-refresh"
        icon={RefreshCw}
        label="Rafraîchir"
        hint="Recharger les données"
        onClick={() => {
          onRefresh?.();
          onClose();
        }}
      />
      <MenuOption
        testID="menu-item-auto-refresh"
        icon={autoRefresh ? Sparkles : Hand}
        label={autoRefresh ? 'Auto' : 'Manuel'}
        hint="Actualisation"
        active={autoRefresh}
        onClick={() => onToggleAutoRefresh?.(!autoRefresh)}
      />
      <MenuOption
        testID="menu-item-reorder"
        icon={SlidersHorizontal}
        label="Réorganiser"
        hint="Widgets, pièces, seuils"
        onClick={() => onNavigate?.('reorder')}
      />
      {canAccessNotifications && (
        <MenuOption
          testID="menu-item-notifications"
          icon={Bell}
          label="Notifications"
          hint="Alertes et seuils"
          onClick={() => onNavigate?.('notifications')}
        />
      )}
      <MenuOption
        testID="menu-item-logout"
        icon={LogOut}
        label="Déconnexion"
        hint="Quitter la session"
        destructive
        onClick={() => signOut()}
      />
    </div>
  );
};

interface MenuOptionProps {
  icon: LucideIcon;
  label: string;
  hint: string;
  onClick: () => void;
  testID?: string;
  active?: boolean;
  destructive?: boolean;
}

const MenuOption = ({
  icon: Icon,
  label,
  hint,
  onClick,
  testID,
  active,
  destructive,
}: MenuOptionProps) => (
  <button
    type="button"
    data-testid={testID}
    onClick={onClick}
    className="flex min-h-32 flex-col items-start justify-between gap-4 rounded-3xl bg-muted p-4 text-left transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
  >
    <span
      className={cn(
        'flex size-11 items-center justify-center rounded-full',
        destructive
          ? 'bg-destructive text-destructive-foreground'
          : active
            ? 'bg-accent text-accent-foreground'
            : 'bg-primary text-primary-foreground',
      )}
    >
      <Icon size={20} aria-hidden="true" />
    </span>
    <span className="block">
      <span
        className={cn(
          'block font-display text-lg leading-tight font-semibold',
          destructive ? 'text-destructive' : 'text-foreground',
        )}
      >
        {label}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
    </span>
  </button>
);
