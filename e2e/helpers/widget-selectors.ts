/**
 * Centralized CSS/testID selectors for all widgets and interactive elements.
 * Use these in tests to avoid hardcoded strings and improve maintainability.
 *
 * Convention: widgets expose `data-testid` (BaseWidget renders `widget-<id>` by default).
 */

// ── Widget Containers ────────────────────────────────────────────────────────────

export const WIDGET = {
  lights: '[data-testid="widget-lights"]',
  alarm: '[data-testid="widget-alarm"]',
  temperature: '[data-testid="widget-temperature"]',
  weather: '[data-testid="widget-weather"]',
  electricity: '[data-testid="widget-electricity"]',
  gas: '[data-testid="widget-gas"]',
  petkit: '[data-testid="widget-petkit"]',
  arlo: '[data-testid="widget-arlo"]',
  plugs: '[data-testid="widget-plugs"]',
  spa: '[data-testid="widget-spa"]',
  water: '[data-testid="widget-water"]',
  bambu_lab: '[data-testid="widget-bambu-lab"]',
  climate: '[data-testid="widget-climate"]',
  washing_machine: '[data-testid="widget-washing-machine"]',
} as const;

/** Section (URL hash, `/#maison`) showing each widget. */
export const WIDGET_SECTION = {
  lights: 'maison',
  temperature: 'maison',
  climate: 'maison',
  weather: 'maison',
  plugs: 'maison',
  electricity: 'energie',
  gas: 'energie',
  water: 'energie',
  alarm: 'securite',
  arlo: 'securite',
  petkit: 'animaux',
  spa: 'appareils',
  washing_machine: 'appareils',
  bambu_lab: 'appareils',
} as const satisfies Record<keyof typeof WIDGET, string>;

// ── Lights Widget ────────────────────────────────────────────────────────────────

export const LIGHT = {
  /** Card for a specific light: `[data-testid="light-card-{entityId}"]` */
  card: (entityId: string) => `[data-testid="light-card-${entityId}"]`,
  /** Toggle button: `[data-testid="light-toggle-{entityId}"]` */
  toggle: (entityId: string) => `[data-testid="light-toggle-${entityId}"]`,
  /** Brightness slider: `[data-testid="light-brightness-{entityId}"]` */
  brightness: (entityId: string) => `[data-testid="light-brightness-${entityId}"]`,
} as const;

// ── Alarm Widget ─────────────────────────────────────────────────────────────────

export const ALARM = {
  armButton: '[data-testid="alarm-btn-arm_away"]',
  disarmButton: '[data-testid="alarm-btn-disarm"]',
} as const;

// ── Temperature Widget ───────────────────────────────────────────────────────────

export const TEMPERATURE = {
  /** Sensor row (click expands its history): `[data-testid="temp-row-{tempEntityId}"]` */
  row: (tempEntityId: string) => `[data-testid="temp-row-${tempEntityId}"]`,
} as const;

// ── Climate Widget ───────────────────────────────────────────────────────────────

export const CLIMATE = {
  card: (entityId: string) => `[data-testid="climate-card-${entityId}"]`,
  power: (entityId: string) => `[data-testid="climate-power-${entityId}"]`,
  mode: (mode: string, entityId: string) => `[data-testid="climate-mode-${mode}-${entityId}"]`,
  tempSlider: (entityId: string) => `[data-testid="climate-temp-slider-${entityId}"]`,
} as const;

// ── PetKit Widget ────────────────────────────────────────────────────────────────

export const PETKIT = {
  feedButton: '[data-testid="petkit-feed"]',
  syncButton: '[data-testid="petkit-sync"]',
} as const;

// ── Plugs Widget ─────────────────────────────────────────────────────────────────

export const PLUG = {
  /** Plug ids are the PlugsWidget ids (`pc`, `tv`), not entity ids */
  card: (plugId: string) => `[data-testid="plug-card-${plugId}"]`,
  toggle: (plugId: string) => `[data-testid="plug-toggle-${plugId}"]`,
} as const;
