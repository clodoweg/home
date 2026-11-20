/**
 * Widget Configuration Constants
 * Defines the icon, title and domain tone of each dashboard widget type.
 */
import {
  Lightbulb,
  Thermometer,
  Video,
  Bell,
  Droplets,
  Zap,
  Flame,
  Cat,
  CloudSun,
  AirVent,
  WashingMachine,
  Printer,
} from 'lucide-react';

import type { IconComponent } from '../types/icon';

/** Domain colour of a tile or chip (`--color-<tone>` in global.css); `neutral` is the strong neutral. */
export type Tone = 'sun' | 'tangerine' | 'coral' | 'lime' | 'aqua' | 'lilac' | 'cobalt' | 'neutral';

/** Fill and text classes of each tone: the text colour is fixed, a tone looks the same in both themes. */
export const TONE_CLASSES: Record<Tone, string> = {
  sun: 'bg-sun text-ink',
  tangerine: 'bg-tangerine text-ink',
  coral: 'bg-coral text-ink',
  lime: 'bg-lime text-ink',
  aqua: 'bg-aqua text-ink',
  lilac: 'bg-lilac text-ink',
  cobalt: 'bg-cobalt text-white',
  neutral: 'bg-primary text-primary-foreground',
};

export interface WidgetConfig {
  title: string;
  icon: IconComponent;
  tone: Tone;
  /** Takes two columns of its section on a wide screen (one on a phone). */
  wide?: boolean;
}

export const WIDGET_CONFIG: Record<string, WidgetConfig> = {
  lights: {
    title: 'Lumières',
    icon: Lightbulb,
    tone: 'sun',
    wide: true,
  },
  temperature: {
    title: 'Température',
    icon: Thermometer,
    tone: 'cobalt',
    wide: true,
  },
  arlo: {
    title: 'Caméras',
    icon: Video,
    tone: 'coral',
    wide: true,
  },
  alarm: {
    title: 'Alarme',
    icon: Bell,
    tone: 'coral',
  },
  spa: {
    title: 'Spa',
    icon: Droplets,
    tone: 'aqua',
  },
  plugs: {
    title: 'Prises',
    icon: Zap,
    tone: 'lime',
  },
  electricity: {
    title: 'Électricité',
    icon: Zap,
    tone: 'lime',
  },
  gas: {
    title: 'Gaz',
    icon: Flame,
    tone: 'lime',
  },
  water: {
    title: 'Eau',
    icon: Droplets,
    tone: 'lime',
  },
  feeder: {
    title: 'Croquettes',
    icon: Cat,
    tone: 'tangerine',
  },
  fountain: {
    title: 'Fontaine',
    icon: Droplets,
    tone: 'tangerine',
  },
  weather: {
    title: 'Météo',
    icon: CloudSun,
    tone: 'aqua',
  },
  climate: {
    title: 'Climatisation',
    icon: AirVent,
    tone: 'cobalt',
  },
  washing_machine: {
    title: 'Lave-linge',
    icon: WashingMachine,
    tone: 'neutral',
  },
  bambu_lab: {
    title: 'Imprimante 3D',
    icon: Printer,
    tone: 'neutral',
  },
};
