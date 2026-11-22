/**
 * entities — Home Assistant entity ids the dashboard relies on. They come from the house's
 * integrations (Somfy, spa, Sonoff plugs, SmartThings washing machine, Aarlo, Bambu Lab): renaming
 * an entity in Home Assistant means changing it here.
 */

/** An entity id of the given Home Assistant domain, e.g. `switch.spa_power`. */
export type EntityId<Domain extends string = string> = `${Domain}.${string}`;

export const ALARM_SIREN: EntityId<'switch'> = 'switch.somfy_home_alarm_siren';

export const SPA_ENTITIES = {
  climate: 'climate.spa_thermostat',
  power: 'switch.spa_power',
  filter: 'switch.spa_filter',
  bubbles: 'select.spa_bubbles',
  error: 'binary_sensor.spa_errors',
  connected: 'binary_sensor.spa_connected',
} as const satisfies Record<string, EntityId>;

export const PLUG_ENTITIES = {
  plugPC: 'switch.prise_pc',
  plugTV: 'switch.prise_tv',
  powerPC: 'sensor.prise_pc_puissance',
  powerTV: 'sensor.prise_tv_puissance',
  energyPC: 'sensor.prise_pc_consommation',
  energyTV: 'sensor.prise_tv_consommation',
} as const satisfies Record<string, EntityId>;

/** Every washing machine entity id contains this (sensors, binary sensors and buttons). */
export const WASHING_MACHINE_MARKER = '.washing_machine_';

/**
 * Washing machine entity id.
 *
 * @param domain - Home Assistant domain.
 * @param key - Entity key after the `washing_machine_` prefix.
 * @returns The entity id, e.g. `sensor.washing_machine_mode`.
 */
export const washingMachineEntity = <Domain extends string>(
  domain: Domain,
  key: string,
): EntityId<Domain> => `${domain}${WASHING_MACHINE_MARKER}${key}` as EntityId<Domain>;

/** Aarlo camera entities: `camera.aarlo_<name>` and its sensors `…aarlo_<kind>_<name>`. */
export const ARLO_PREFIXES = {
  camera: 'camera.aarlo_',
  motion: 'binary_sensor.aarlo_motion_',
  connected: 'binary_sensor.aarlo_connected_',
  lastCapture: 'sensor.aarlo_last_',
} as const;

/**
 * Whether an entity belongs to an Aarlo camera (the camera or one of its sensors).
 *
 * @param entityId - Entity id.
 * @returns True for `camera.aarlo_*` and the Aarlo motion, connection and capture sensors.
 */
export const isArloEntity = (entityId: string): boolean =>
  Object.values(ARLO_PREFIXES).some((prefix) => entityId.startsWith(prefix));

/**
 * Bambu Lab printer lights, which are not home lights: the model as first word of the id
 * (`light.a1_…`, `light.p1s_…`), "bambu" anywhere, or a printer-light suffix.
 */
export const PRINTER_LIGHT_PATTERN =
  /(?:^light\.(?:p1s|x1c|p1p|a1)(?:_|$))|bambu|(?:(?:_chamber_light|_lumiere_de_la_chambre|_printer_light)$)/;

/** Where each printer value is looked up: Home Assistant domain and accepted id suffixes. */
export const PRINTER_LOOKUPS = {
  status: {
    domain: 'sensor',
    suffixes: [
      '_etat_de_l_impression',
      '_etape_actuelle',
      '_print_status',
      '_print_state',
      '_current_stage',
      '_stage',
      '_status',
    ],
  },
  progress: {
    domain: 'sensor',
    suffixes: ['_progression_de_l_impression', '_print_progress', '_progress', '_mc_percent'],
  },
  currentLayer: {
    domain: 'sensor',
    suffixes: ['_couche_actuelle', '_current_layer', '_layer', '_mc_layer_num'],
  },
  totalLayers: {
    domain: 'sensor',
    suffixes: [
      '_nombre_total_de_couches',
      '_total_layer_count',
      '_total_layers',
      '_layers',
      '_mc_total_layer_num',
    ],
  },
  endTime: {
    domain: 'sensor',
    suffixes: ['_heure_de_fin', '_end_time', '_mc_end_time', '_finish_time'],
  },
  remainingTime: {
    domain: 'sensor',
    suffixes: [
      '_temps_restant',
      '_remaining_time',
      '_print_time_left',
      '_time_remaining',
      '_mc_remaining_time',
    ],
  },
  filename: {
    domain: 'sensor',
    suffixes: [
      '_fichier_g_code',
      '_nom_de_la_tache',
      '_gcode_filename',
      '_subtask_name',
      '_gcode_file',
      '_print_file',
      '_filename',
    ],
  },
  nozzleTemp: {
    domain: 'sensor',
    suffixes: ['_temperature_de_la_buse', '_nozzle_temperature', '_nozzle_temp'],
  },
  nozzleTarget: {
    domain: 'sensor',
    suffixes: [
      '_temperature_cible_de_la_buse',
      '_nozzle_target_temperature',
      '_target_nozzle_temperature',
      '_nozzle_target_temp',
    ],
  },
  bedTemp: { domain: 'sensor', suffixes: ['_temperature_du_lit', '_bed_temperature', '_bed_temp'] },
  bedTarget: {
    domain: 'sensor',
    suffixes: [
      '_temperature_cible_du_lit',
      '_bed_target_temperature',
      '_target_bed_temperature',
      '_bed_target_temp',
    ],
  },
  chamberTemp: {
    domain: 'sensor',
    suffixes: ['_temperature_de_la_chambre', '_chamber_temperature', '_chamber_temp'],
  },
  light: {
    domain: 'light',
    suffixes: ['_lumiere_de_la_chambre', '_chamber_light', '_light', '_chamber'],
  },
  speed: {
    domain: 'select',
    suffixes: [
      '_vitesse_d_impression',
      '_profil_de_vitesse',
      '_printing_speed',
      '_speed_profile',
      '_speed',
    ],
  },
} as const satisfies Record<string, { domain: string; suffixes: readonly string[] }>;

/**
 * Entities the printer widget can use: those matching one of its lookups. Passing only these
 * keeps the widget from re-rendering when an unrelated entity changes.
 *
 * @param entities - Every Home Assistant entity.
 * @returns The candidate entities, in their original order.
 */
export const selectPrinterEntities = <T extends { entity_id: string }>(entities: T[]): T[] =>
  entities.filter((e) => {
    if (!e || typeof e.entity_id !== 'string') return false;
    const id = e.entity_id.toLowerCase();
    return Object.values(PRINTER_LOOKUPS).some(
      ({ domain, suffixes }) =>
        id.startsWith(`${domain}.`) && suffixes.some((suffix) => id.endsWith(suffix)),
    );
  });

const PRINTER_KEYWORDS = ['p1s', 'bambu', 'x1c', 'p1p', 'a1', 'printer', '3d'];
const OTHER_APPLIANCE_KEYWORDS = [
  'washing_machine',
  'lave_linge',
  'dryer',
  'seche_linge',
  'dishwasher',
  'lave_vaisselle',
];

/**
 * Entity holding one printer value. The suffixes are generic (`_status`, `_progress`): an entity
 * naming the printer wins, and one naming another appliance is never taken.
 *
 * @param entities - Candidate entities (see selectPrinterEntities).
 * @param lookup - Domain and accepted id suffixes, one of PRINTER_LOOKUPS.
 * @returns The entity, or undefined when the printer does not expose the value.
 */
export const findPrinterEntity = <T extends { entity_id: string }>(
  entities: T[],
  lookup: { domain: string; suffixes: readonly string[] },
): T | undefined => {
  if (!Array.isArray(entities)) return undefined;
  const prefix = `${lookup.domain}.`.toLowerCase();
  const candidates = entities.filter((e) => {
    if (!e || typeof e.entity_id !== 'string') return false;
    const id = e.entity_id.toLowerCase();
    return (
      id.startsWith(prefix) && lookup.suffixes.some((suffix) => id.endsWith(suffix.toLowerCase()))
    );
  });
  const named = candidates.find((e) =>
    PRINTER_KEYWORDS.some((keyword) => e.entity_id.toLowerCase().includes(keyword)),
  );
  return (
    named ??
    candidates.find(
      (e) =>
        !OTHER_APPLIANCE_KEYWORDS.some((keyword) => e.entity_id.toLowerCase().includes(keyword)),
    )
  );
};
