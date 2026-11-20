/**
 * ThresholdsTab — Colour thresholds of the dashboard and, for admins, Telegram alert thresholds:
 * edited locally, validated, then saved in one call.
 */
import React, { useId, useState } from 'react';
import { useWidgetPreferences } from '../../context/WidgetPreferencesContext';
import { useUserProfile } from '../../context/UserContext';
import { cn } from '../../lib/utils';
import type {
  HumidityThresholds,
  NotificationThresholds,
  TemperatureThresholds,
} from '../../services/api';

type AlertThresholds = Omit<NotificationThresholds, 'notificationHumidityThreshold'>;

interface ThresholdsDraft {
  temp: TemperatureThresholds;
  hum: HumidityThresholds;
  notifications: AlertThresholds;
}

type Level = 'MinRed' | 'MinOrange' | 'MaxOrange' | 'MaxRed';

const LEVELS: { level: Level; label: string }[] = [
  { level: 'MinRed', label: 'Rouge Min' },
  { level: 'MinOrange', label: 'Orange Min' },
  { level: 'MaxOrange', label: 'Orange Max' },
  { level: 'MaxRed', label: 'Rouge Max' },
];

/** Each pair must be strictly increasing, with the message shown otherwise. */
const LEVEL_RULES: { lower: Level; upper: Level; message: string }[] = [
  {
    lower: 'MinRed',
    upper: 'MinOrange',
    message: 'Le seuil rouge minimal doit être inférieur au seuil orange minimal.',
  },
  {
    lower: 'MinOrange',
    upper: 'MaxOrange',
    message: 'Le seuil orange minimal doit être inférieur au seuil orange maximal.',
  },
  {
    lower: 'MaxOrange',
    upper: 'MaxRed',
    message: 'Le seuil orange maximal doit être inférieur au seuil rouge maximal.',
  },
];

type GroupPrefix = 'tempIndoor' | 'tempOutdoor' | 'humIndoor' | 'humOutdoor';

const GROUPS: {
  prefix: GroupPrefix;
  kind: 'temp' | 'hum';
  title: string;
  name: string;
}[] = [
  {
    prefix: 'tempIndoor',
    kind: 'temp',
    title: 'Températures Intérieures (Cave, RdC, Étage)',
    name: 'Température intérieure',
  },
  {
    prefix: 'tempOutdoor',
    kind: 'temp',
    title: 'Températures Extérieures',
    name: 'Température extérieure',
  },
  {
    prefix: 'humIndoor',
    kind: 'hum',
    title: 'Humidité Intérieure (Cave, RdC, Étage)',
    name: 'Humidité intérieure',
  },
  { prefix: 'humOutdoor', kind: 'hum', title: 'Humidité Extérieure', name: 'Humidité extérieure' },
];

type AlertRule =
  | { key: keyof AlertThresholds; max: number; message: string }
  | { min: keyof AlertThresholds; max: keyof AlertThresholds; message: string };

/** Telegram alerts, checked in this order: a range (0 to max) or a min < max pair. */
const ALERT_RULES: AlertRule[] = [
  {
    key: 'notificationSpaTempThreshold',
    max: 50,
    message: 'Notifications Telegram Spa : La température doit être comprise entre 0°C et 50°C.',
  },
  {
    key: 'notificationTempMinThreshold',
    max: 50,
    message:
      'Notifications Telegram Température Min : La température doit être comprise entre 0°C et 50°C.',
  },
  {
    key: 'notificationTempMaxThreshold',
    max: 50,
    message:
      'Notifications Telegram Température Max : La température doit être comprise entre 0°C et 50°C.',
  },
  {
    min: 'notificationTempMinThreshold',
    max: 'notificationTempMaxThreshold',
    message:
      'Notifications Telegram Température : Le seuil minimal doit être inférieur au seuil maximal.',
  },
  {
    key: 'notificationHumidityMinThreshold',
    max: 100,
    message:
      "Notifications Telegram Humidité Min : Le taux d'humidité doit être compris entre 0% et 100%.",
  },
  {
    key: 'notificationHumidityMaxThreshold',
    max: 100,
    message:
      "Notifications Telegram Humidité Max : Le taux d'humidité doit être compris entre 0% et 100%.",
  },
  {
    min: 'notificationHumidityMinThreshold',
    max: 'notificationHumidityMaxThreshold',
    message:
      'Notifications Telegram Humidité : Le seuil minimal doit être inférieur au seuil maximal.',
  },
];

const levelValue = (draft: ThresholdsDraft, kind: 'temp' | 'hum', key: string): number =>
  (draft[kind] as unknown as Record<string, number>)[key];

/**
 * First validation error of the draft, if any.
 *
 * @param draft - Values being edited.
 * @param isAdmin - Whether the Telegram thresholds are edited too.
 * @returns The message to show, or null when everything is valid.
 */
const findValidationError = (draft: ThresholdsDraft, isAdmin: boolean): string | null => {
  for (const group of GROUPS) {
    for (const rule of LEVEL_RULES) {
      const lower = levelValue(draft, group.kind, group.prefix + rule.lower);
      const upper = levelValue(draft, group.kind, group.prefix + rule.upper);
      if (lower >= upper) return `${group.name} : ${rule.message}`;
    }
  }
  if (!isAdmin) return null;
  const values = draft.notifications;
  for (const rule of ALERT_RULES) {
    if ('key' in rule) {
      if (values[rule.key] < 0 || values[rule.key] > rule.max) return rule.message;
    } else if (values[rule.min] >= values[rule.max]) {
      return rule.message;
    }
  }
  return null;
};

const INPUT_CLASS =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden';
const LABEL_CLASS =
  'mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground';

interface ThresholdInputProps {
  label: string;
  value: number;
  integer?: boolean;
  onValueChange: (value: number) => void;
  testId?: string;
}

/**
 * Number field that keeps what is being typed (a lone "-" or an empty field) while giving the
 * parent a number at every keystroke; a value pushed by the parent replaces the text.
 */
const ThresholdInput = ({ label, value, integer, onValueChange, testId }: ThresholdInputProps) => {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setText(String(value));
  }

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        step={integer ? '1' : '0.5'}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          const parsed = (integer ? parseInt(raw, 10) : parseFloat(raw)) || 0;
          setText(raw);
          setShownValue(parsed);
          onValueChange(parsed);
        }}
        onBlur={() => setText(String(value))}
        data-testid={testId}
        className={INPUT_CLASS}
      />
    </div>
  );
};

/** Thresholds tab of the customization screen. */
export const ThresholdsTab = () => {
  const {
    tempThresholds,
    humThresholds,
    notificationSpaTempThreshold,
    notificationTempMinThreshold,
    notificationTempMaxThreshold,
    notificationHumidityMinThreshold,
    notificationHumidityMaxThreshold,
    updateThresholds,
  } = useWidgetPreferences();
  const { isAdmin } = useUserProfile();

  const saved: ThresholdsDraft = {
    temp: tempThresholds,
    hum: humThresholds,
    notifications: {
      notificationSpaTempThreshold,
      notificationTempMinThreshold,
      notificationTempMaxThreshold,
      notificationHumidityMinThreshold,
      notificationHumidityMaxThreshold,
    },
  };
  // Compared by value: the context rebuilds these objects whenever any preference changes, and
  // that must not wipe what is being edited.
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState(saved);
  const [draftSourceKey, setDraftSourceKey] = useState(savedKey);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Not during this screen's own save: a failed save rolls the values back, and the user must
  // keep what they typed to try again.
  if (savedKey !== draftSourceKey && !isSaving) {
    setDraftSourceKey(savedKey);
    setDraft(saved);
  }

  const setLevel = (kind: 'temp' | 'hum', key: string, value: number) =>
    setDraft((current) => ({ ...current, [kind]: { ...current[kind], [key]: value } }));
  const setAlert = (key: keyof AlertThresholds, value: number) =>
    setDraft((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: value },
    }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = findValidationError(draft, isAdmin);
    setMessage(error);
    if (error) return;
    setIsSaving(true);
    try {
      await updateThresholds({
        temp: draft.temp,
        hum: draft.hum,
        // Telegram alert thresholds are an admin setting.
        notifications: isAdmin ? draft.notifications : undefined,
      });
      setMessage('Seuils sauvegardés avec succès !');
    } catch {
      setMessage('Erreur lors de la sauvegarde.');
    } finally {
      setIsSaving(false);
    }
  };

  const alertInput = (
    key: keyof AlertThresholds,
    label: string,
    testId: string,
    integer = false,
  ) => (
    <ThresholdInput
      label={label}
      value={draft.notifications[key]}
      integer={integer}
      onValueChange={(value) => setAlert(key, value)}
      testId={`input-telegram-${testId}`}
    />
  );

  return (
    <form onSubmit={handleSave} className="mx-auto flex max-w-[800px] flex-col gap-6">
      {message && (
        <div
          role="status"
          className={cn(
            'rounded-xl p-4 text-center text-xs font-semibold',
            message.includes('succès')
              ? 'border border-success/20 bg-success/10 text-success'
              : 'border border-destructive/20 bg-destructive/10 text-destructive',
          )}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {GROUPS.map((group) => {
          const unit = group.kind === 'temp' ? '°C' : '%';
          return (
            <div key={group.prefix} className="rounded-2xl bg-muted p-5">
              <h3 className="mb-4 text-xs font-bold tracking-wider text-primary uppercase">
                {group.title}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {LEVELS.map(({ level, label }) => {
                  const key = group.prefix + level;
                  return (
                    <ThresholdInput
                      key={key}
                      label={`${label} (${unit})`}
                      value={levelValue(draft, group.kind, key)}
                      integer={group.kind === 'hum'}
                      onValueChange={(value) => setLevel(group.kind, key, value)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {isAdmin && (
          <div className="rounded-2xl bg-muted p-5 md:col-span-2">
            <h3 className="mb-4 text-xs font-bold tracking-wider text-primary uppercase">
              Seuils de Notifications Telegram (Admin)
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <h4 className="mb-3 text-[11px] font-bold tracking-widest text-foreground uppercase">
                  Spa
                </h4>
                {alertInput('notificationSpaTempThreshold', 'Alerte Température Spa (°C)', 'spa')}
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <h4 className="mb-3 text-[11px] font-bold tracking-widest text-foreground uppercase">
                  Températures Ambiantes
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {alertInput('notificationTempMinThreshold', 'Min (°C)', 'temp-min')}
                  {alertInput('notificationTempMaxThreshold', 'Max (°C)', 'temp-max')}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 sm:col-span-2">
                <h4 className="mb-3 text-[11px] font-bold tracking-widest text-foreground uppercase">
                  Taux d'Humidité
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {alertInput('notificationHumidityMinThreshold', 'Min (%)', 'hum-min', true)}
                  {alertInput('notificationHumidityMaxThreshold', 'Max (%)', 'hum-max', true)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/95 disabled:opacity-50"
        disabled={isSaving}
      >
        {isSaving ? 'Sauvegarde...' : 'Sauvegarder les seuils'}
      </button>
    </form>
  );
};
