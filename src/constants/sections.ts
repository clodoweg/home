/**
 * sections — The screens of the app: the home overview, then one section per domain, each listing
 * the widgets it shows. A section's id is also its URL hash (`#maison`).
 */
import { Cat, History, House, LayoutGrid, ShieldCheck, WashingMachine, Zap } from 'lucide-react';

import type { IconComponent } from '../types/icon';
import type { Tone } from './widgets';

export type SectionId =
  'accueil' | 'maison' | 'energie' | 'securite' | 'animaux' | 'appareils' | 'historique';

export interface Section {
  id: SectionId;
  label: string;
  icon: IconComponent;
  tone: Tone;
  /** Widget ids shown in the section; the user's order applies inside it. */
  widgets: readonly string[];
}

export const HOME_SECTION: SectionId = 'accueil';

/** The history tab: no widget of its own, offered with the history right. */
export const HISTORY_SECTION: SectionId = 'historique';

export const SECTIONS: readonly Section[] = [
  { id: 'accueil', label: 'Accueil', icon: LayoutGrid, tone: 'neutral', widgets: [] },
  {
    id: 'maison',
    label: 'Maison',
    icon: House,
    tone: 'sun',
    widgets: ['lights', 'temperature', 'climate', 'weather', 'plugs'],
  },
  {
    id: 'energie',
    label: 'Énergie',
    icon: Zap,
    tone: 'lime',
    widgets: ['electricity', 'gas', 'water'],
  },
  {
    id: 'securite',
    label: 'Sécurité',
    icon: ShieldCheck,
    tone: 'coral',
    widgets: ['alarm', 'arlo'],
  },
  {
    id: 'animaux',
    label: 'Animaux',
    icon: Cat,
    tone: 'tangerine',
    widgets: ['feeder', 'fountain'],
  },
  {
    id: 'appareils',
    label: 'Appareils',
    icon: WashingMachine,
    tone: 'aqua',
    widgets: ['spa', 'washing_machine', 'bambu_lab'],
  },
  { id: 'historique', label: 'Historique', icon: History, tone: 'neutral', widgets: [] },
];

/**
 * Section showing a widget.
 *
 * @param widgetId - Widget id (`lights`, `gas`…).
 * @returns The section id, or the home section for an unknown widget.
 */
export const sectionOfWidget = (widgetId: string): SectionId =>
  SECTIONS.find((section) => section.widgets.includes(widgetId))?.id ?? HOME_SECTION;

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    // A hand-typed hash with a stray `%`: no detail rather than a crash.
    return '';
  }
};

/** What a URL hash asks for: a section, the widgets to unfold and, for one of them, a detail. */
export interface SectionHash {
  section: SectionId;
  focus: string[];
  /** Part of the first focused widget to open, e.g. a temperature sensor's entity id. */
  detail?: string;
}

/**
 * Section and widgets to unfold named by a URL hash: `#maison`, or `#maison/lights` to open the
 * section with only the lights widget unfolded (`#animaux/feeder+fountain` for several), or
 * `#maison/temperature/sensor.cave_temperature` to also open one part of that widget.
 *
 * @param hash - `location.hash`, with or without the leading `#`.
 * @returns The section id (home for an empty or unknown hash), the widget ids to unfold and the
 * detail to open, if any.
 */
export const parseSectionHash = (hash: string): SectionHash => {
  const [id, widgets = '', detail = ''] = hash.replace(/^#/, '').split('/');
  const section = SECTIONS.find((candidate) => candidate.id === id)?.id ?? HOME_SECTION;
  if (section === HOME_SECTION) return { section, focus: [] };
  const focus = widgets.split('+').filter(Boolean);
  const decodedDetail = safeDecode(detail);
  return focus.length > 0 && decodedDetail
    ? { section, focus, detail: decodedDetail }
    : { section, focus };
};

/**
 * Link to the section of some widgets, with only those widgets unfolded.
 *
 * @param widgetIds - Widgets of one section, the first one deciding the section.
 * @returns The hash, e.g. `#maison/lights`.
 */
export const widgetHref = (...widgetIds: string[]): string =>
  `#${sectionOfWidget(widgetIds[0])}/${widgetIds.join('+')}`;

/**
 * Link to one part of a widget: its section opens with only that widget unfolded, and the widget
 * opens that part (the temperature widget unfolds the sensor's row and its chart).
 *
 * @param widgetId - Widget id (`temperature`).
 * @param detail - Part to open, e.g. the sensor's entity id.
 * @returns The hash, e.g. `#maison/temperature/sensor.cave_temperature`.
 */
export const widgetDetailHref = (widgetId: string, detail: string): string =>
  `${widgetHref(widgetId)}/${encodeURIComponent(detail)}`;
