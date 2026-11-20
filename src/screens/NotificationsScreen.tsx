/**
 * NotificationsScreen — Telegram notification configuration for admin users.
 * Lets the admin enter their Telegram chat ID and toggle which categories
 * of events should push a message (alarm / lights / spa / fountain / feeder).
 */
import React, { useState } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import type { NotificationPreferences, NotificationSettings } from '../services/api';
import {
  useNotificationSettings,
  useSaveNotificationSettings,
} from '../hooks/useNotificationSettings';
import { Panel } from '../components/ui/Panel';
import { logger } from '../lib/logger';

const CATEGORIES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'alarm', label: 'Alarme', description: 'Activation, désactivation, sirène, SOS' },
  {
    key: 'motion',
    label: 'Mouvement',
    description: 'Mouvement détecté par les caméras quand l’alarme est activée (avec photos)',
  },
  { key: 'lights', label: 'Lumières', description: "Allumage/extinction d'une pièce" },
  { key: 'spa', label: 'Spa', description: 'Température sous 36°C' },
  { key: 'fountain', label: 'Fontaine', description: "Plus d'eau dans la fontaine" },
  { key: 'feeder', label: 'Distributeur', description: 'Bac de croquettes vide' },
  {
    key: 'washingMachine',
    label: 'Lave-linge',
    description: 'Fin de cycle de lavage ou erreur détectée sur la machine',
  },
  {
    key: 'printer',
    label: 'Imprimante 3D',
    description: 'Fin d’impression 3D, mise en pause ou erreur sur l’imprimante',
  },
  {
    key: 'temperature',
    label: 'Température',
    description: 'Alerte température hors seuil de confort (capteurs Sonoff)',
  },
  {
    key: 'humidity',
    label: 'Humidité',
    description: 'Alerte humidité hors seuil de confort',
  },
];

/**
 * Telegram notification settings of the admin.
 *
 * @returns The form once the settings are loaded, or a retry message if they could not be.
 */
export const NotificationsScreen = () => {
  const { data, isError, refetch, isFetching, isFetchedAfterMount } = useNotificationSettings();

  // The form is only shown with the stored settings: saving defaults would erase them.
  if (isError && !data) {
    return (
      <div className="flex flex-col items-center gap-3 p-12 text-center">
        <p className="text-sm text-destructive">Impossible de charger les préférences.</p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // The form copies the settings once: it waits for this visit's fetch, so that a change made on
  // another device since the last visit is not overwritten by a cached copy.
  if (!data || !isFetchedAfterMount) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return <NotificationsForm initial={data} />;
};

const NotificationsForm = ({ initial }: { initial: NotificationSettings }) => {
  const [chatId, setChatId] = useState(initial.telegramChatId ?? '');
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial.notificationPreferences);
  const saveSettings = useSaveNotificationSettings();

  const handleSave = () => {
    saveSettings
      .mutateAsync({ telegramChatId: chatId.trim() || null, notificationPreferences: prefs })
      .catch((e) => logger.error('Failed to save notification settings', e));
  };

  const toggle = (key: keyof NotificationPreferences) => {
    // A category without a stored preference is on (see `enabled` below): one click turns it off.
    setPrefs((prev) => ({ ...prev, [key]: prev[key] === false }));
  };
  const saving = saveSettings.isPending;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Panel className="rounded-2xl">
        <div className="mb-3 flex flex-row items-center gap-2">
          <Bell size={16} className="text-primary" />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Telegram
          </span>
        </div>
        <label className="mb-2 block text-sm text-muted-foreground" htmlFor="telegram-chat-id">
          Chat ID Telegram
        </label>
        <input
          id="telegram-chat-id"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="Ex: 123456789"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-hidden focus:border-primary"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Envoie <code>/start</code> au bot puis récupère ton chat ID via <code>@userinfobot</code>.
          Laisse vide pour désactiver.
        </p>
      </Panel>

      <Panel className="rounded-2xl">
        <div className="mb-3 flex flex-row items-center gap-2">
          <Bell size={16} className="text-primary" />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Catégories
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {CATEGORIES.map(({ key, label, description }) => {
            const enabled = prefs[key] !== false; // default to enabled
            return (
              <button
                key={key}
                type="button"
                aria-pressed={enabled}
                onClick={() => toggle(key)}
                className="flex flex-row items-center justify-between rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted"
              >
                <div>
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <span
                  className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                    enabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`size-5 rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check size={16} />}
        Enregistrer
      </button>
      {saveSettings.isSuccess && (
        <p role="status" className="text-center text-xs text-success">
          Préférences enregistrées
        </p>
      )}
      {saveSettings.isError && (
        <p role="alert" className="text-center text-xs text-destructive">
          Erreur lors de l'enregistrement. Réessayez dans un instant.
        </p>
      )}
    </div>
  );
};
