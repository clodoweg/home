/**
 * AlertsScreen — The admin's bell panel: latest alerts (30 days), newest first, each opening its
 * widget; and the switch that sends them as push notifications to this device.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Cat,
  Droplets,
  Footprints,
  Lightbulb,
  Printer,
  ShieldAlert,
  Thermometer,
  WashingMachine,
  Waves,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { useAlertNotifications } from '../hooks/useAlertNotifications';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { alertHref } from '../lib/alert-notifications';
import { cn } from '../lib/utils';
import type { NotificationCategory } from '../services/api';

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  alarm: ShieldAlert,
  motion: Footprints,
  lights: Lightbulb,
  temperature: Thermometer,
  humidity: Droplets,
  spa: Waves,
  fountain: Droplets,
  feeder: Cat,
  washingMachine: WashingMachine,
  printer: Printer,
};

/**
 * How long ago an alert came, in words.
 *
 * @param iso - Date of the alert.
 * @param now - Current time.
 * @returns « à l'instant », « il y a 5 min », « il y a 3 h », « hier 18:04 » or « 12 nov. 18:04 ».
 */
export function formatAlertTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 6 * 60) return `il y a ${Math.floor(minutes / 60)} h`;
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return time;
  if (date.toDateString() === yesterday.toDateString()) return `hier ${time}`;
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${time}`;
}

const PUSH_HINT: Record<string, string> = {
  subscribed: 'Les alertes arrivent sur cet appareil, même appli fermée.',
  unsubscribed: 'Recevez les alertes sur cet appareil, même appli fermée.',
  denied: 'Notifications bloquées pour ce site : autorisez-les dans les réglages du navigateur.',
  unsupported:
    'Ce navigateur ne reçoit pas de notifications (installez l’appli sur l’écran d’accueil).',
};

/** Switch of this device's push notifications. */
const PushSwitch = () => {
  const { status, busy, enable, disable } = usePushSubscription();
  const subscribed = status === 'subscribed';
  const canToggle = status === 'subscribed' || status === 'unsubscribed';
  return (
    <div className="flex flex-row items-center gap-3 rounded-2xl bg-muted p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Notifications sur cet appareil</p>
        <p data-testid="push-hint" className="mt-0.5 text-xs text-muted-foreground">
          {PUSH_HINT[status]}
        </p>
      </div>
      {canToggle && (
        <Button
          data-testid="push-toggle"
          label={subscribed ? 'Désactiver' : 'Activer'}
          icon={subscribed ? BellOff : Bell}
          aria-pressed={subscribed}
          variant={subscribed ? 'secondary' : 'default'}
          loading={busy}
          onClick={() => void (subscribed ? disable() : enable())}
          className="shrink-0"
        />
      )}
    </div>
  );
};

interface AlertsScreenProps {
  /** Closes the panel (when an alert opens its widget). */
  onClose: () => void;
}

/**
 * The bell's panel. Opening it marks every alert read; those that were unread stay highlighted
 * until it closes.
 *
 * @param props - The close callback.
 * @returns The panel content.
 */
export const AlertsScreen = ({ onClose }: AlertsScreenProps) => {
  const { notifications, unread, isLoading, markAllRead } = useAlertNotifications();
  const [freshIds, setFreshIds] = useState<ReadonlySet<number> | null>(null);

  // What was new when the panel opened stays highlighted after it is marked read.
  if (freshIds === null && !isLoading) {
    setFreshIds(new Set(notifications.filter((item) => !item.read).map((item) => item.id)));
  }
  // Once per opening (StrictMode runs effects twice); alerts arriving meanwhile stay unread.
  const markedReadRef = useRef(false);
  useEffect(() => {
    if (freshIds === null || markedReadRef.current) return;
    markedReadRef.current = true;
    if (unread > 0) markAllRead();
  }, [freshIds, unread, markAllRead]);

  return (
    <div data-testid="alerts-screen" className="flex flex-col gap-4 px-4 pb-4 md:px-6 md:pb-6">
      <PushSwitch />
      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : notifications.length === 0 ? (
        <p
          data-testid="alerts-empty"
          className="py-8 text-center text-sm font-medium text-muted-foreground"
        >
          Aucune alerte ces 30 derniers jours.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((item) => {
            const Icon = CATEGORY_ICON[item.category] ?? Bell;
            const fresh = freshIds?.has(item.id) ?? !item.read;
            return (
              <li key={item.id}>
                <a
                  href={alertHref(item.category)}
                  onClick={onClose}
                  data-testid={`alert-${item.id}`}
                  data-unread={fresh || undefined}
                  className={cn(
                    'flex flex-row gap-3 rounded-2xl p-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
                    fresh ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted',
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-row items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {item.title}
                        {fresh && <span className="sr-only"> (nouvelle)</span>}
                      </span>
                      <time
                        dateTime={item.createdAt}
                        className="shrink-0 text-xs font-medium text-muted-foreground"
                      >
                        {formatAlertTime(item.createdAt)}
                      </time>
                    </span>
                    <span className="mt-0.5 block text-sm whitespace-pre-line text-muted-foreground">
                      {item.body}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
