/** labels — French labels of Home Assistant states shared by the widgets and the home overview. */

const WEATHER_CONDITIONS: Record<string, string> = {
  'clear-night': 'Nuit claire',
  cloudy: 'Nuageux',
  fog: 'Brouillard',
  hail: 'Grêle',
  lightning: 'Orage',
  'lightning-rainy': 'Orage et pluie',
  partlycloudy: 'Éclaircies',
  pouring: 'Pluie torrentielle',
  rainy: 'Pluvieux',
  snowy: 'Neige',
  'snowy-rainy': 'Pluie et neige',
  sunny: 'Ensoleillé',
  windy: 'Vent',
  'windy-variant': 'Vent variable',
  exceptional: 'Exceptionnel',
};

/**
 * French name of a Home Assistant weather condition.
 *
 * @param condition - State of a `weather.*` entity (`partlycloudy`, `rainy`…).
 * @returns The label, or the raw condition when it is not a known one.
 */
export const translateCondition = (condition: string): string => {
  if (!condition) return 'Inconnu';
  return WEATHER_CONDITIONS[condition] || condition.replace('-', ' ');
};

const ALARM_STATES: Record<string, string> = {
  disarmed: 'Désactivée',
  armed_away: 'Activée',
  armed_home: 'Activée',
  armed_night: 'Mode nuit',
  triggered: 'DÉCLENCHÉE',
  arming: 'Activation...',
  disarming: 'Désactivation...',
  pending: 'En attente',
};

/**
 * French label of an alarm panel state.
 *
 * @param state - State of an `alarm_control_panel.*` entity.
 * @returns The label, or the raw state when it is not a known one.
 */
export const alarmStatusLabel = (state: string): string => ALARM_STATES[state] ?? state;
