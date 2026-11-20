/** washing-machine labels — French labels of the raw SmartThings washing machine values (mode, program, phase, dryness, water hardness). */

/**
 * Translates raw Home Assistant washing machine modes to French.
 *
 * @param {string | undefined} mode Raw mode value from Home Assistant
 * @returns {string} Human readable French translation
 */
export function formatMode(mode: string | undefined): string {
  if (!mode) return 'Arrêt';
  const normalized = mode.trim().toLowerCase();
  const translations: Record<string, string> = {
    '0': 'Arrêt',
    '00': 'Arrêt',
    '1': 'Veille',
    '01': 'Veille',
    '2': 'Lavage',
    '02': 'Lavage',
    '3': 'Rinçage',
    '03': 'Rinçage',
    '4': 'Essorage',
    '04': 'Essorage',
    '5': 'Vidange',
    '05': 'Vidange',
    '6': 'Séchage',
    '06': 'Séchage',
    '7': 'Arrêté',
    '07': 'Arrêté',
    '8': 'En pause',
    '08': 'En pause',
    '9': 'Terminé',
    '09': 'Terminé',
    off: 'Arrêt',
    none: 'Inactif',
    standby: 'Veille',
    idle: 'En attente',
    run: 'En cours',
    running: 'En cours',
    on: 'En cours',
    active: 'En cours',
    pause: 'En pause',
    paused: 'En pause',
    finish: 'Terminé',
    finished: 'Terminé',
    end: 'Terminé',
    completed: 'Terminé',
    done: 'Terminé',
    delayed: 'Départ différé',
    delay: 'Départ différé',
    delayed_start: 'Départ différé',
    stop: 'Arrêté',
    stopped: 'Arrêté',
    wash: 'Lavage',
    washing: 'Lavage',
    main_wash: 'Lavage principal',
    prewash: 'Prélavage',
    pre_wash: 'Prélavage',
    rinse: 'Rinçage',
    rinsing: 'Rinçage',
    spin: 'Essorage',
    spinning: 'Essorage',
    drain: 'Vidange',
    draining: 'Vidange',
    dry: 'Séchage',
    drying: 'Séchage',
    steam: 'Vapeur',
    night_wash: 'Lavage nuit',
    error: 'Erreur',
    fault: 'Erreur',
  };
  return translations[normalized] || (isNaN(Number(mode)) ? mode : 'Arrêté');
}

/**
 * Translates raw program names, numeric IDs, or program codes into French labels.
 *
 * @param {string | null} program Raw program name, ID, or code
 * @returns {string | null} Translated French program name
 */
export function formatProgramName(program: string | null): string | null {
  if (!program) return null;

  let raw = program.trim();
  if (!raw) return null;

  // Extract last part if dots exist (e.g. Laundry.Washer.Program.Cotton -> Cotton)
  if (raw.includes('.')) {
    const parts = raw.split('.');
    raw = parts[parts.length - 1];
  }

  // Normalize separators and case
  let normalized = raw
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ')
    .trim();

  // Strip common technical prefixes
  normalized = normalized.replace(
    /^(program|programme|wm|select|sensor|lot_wash_|lot_|lot|wash_|wash|cycle|option)\s*/,
    '',
  );

  const translations: Record<string, string> = {
    // Exact match keys (including white, colors, bed linen, towels, etc.)
    white: 'Blanc',
    whites: 'Blanc',
    'white wash': 'Linge blanc',
    'whites wash': 'Linge blanc',
    'white cotton': 'Coton blanc',
    'whites cotton': 'Coton blanc',
    'white bed linen': 'Linge de lit blanc',
    'white/color': 'Blanc / Couleur',
    'white/colors': 'Blanc / Couleur',
    'whites/colors': 'Blanc / Couleur',
    'white and color': 'Blanc et couleur',
    'whites & colors': 'Blanc et couleur',
    color: 'Couleur',
    colors: 'Couleur',
    colored: 'Couleur',
    coloured: 'Couleur',
    'color wash': 'Linge couleur',
    'colors wash': 'Linge couleur',
    'colored wash': 'Linge couleur',
    'coloured wash': 'Linge couleur',
    'coloured bed linen': 'Linge de lit couleur',
    'colored bed linen': 'Linge de lit couleur',
    'bed linen': 'Linge de lit / Draps',
    bedlinen: 'Linge de lit / Draps',
    sheets: 'Draps',
    towels: 'Serviettes',
    towel: 'Serviettes',
    curtains: 'Rideaux',
    blankets: 'Couverture / Plaid',

    // Numeric & Code IDs
    '0': 'Arrêt',
    '00': 'Arrêt',
    '1': 'Coton',
    '01': 'Coton',
    p1: 'Coton',
    p01: 'Coton',
    pr1: 'Coton',
    '2': 'Synthétiques',
    '02': 'Synthétiques',
    p2: 'Synthétiques',
    p02: 'Synthétiques',
    pr2: 'Synthétiques',
    '3': 'Mixte',
    '03': 'Mixte',
    p3: 'Mixte',
    p03: 'Mixte',
    pr3: 'Mixte',
    '4': 'Délicat',
    '04': 'Délicat',
    p4: 'Délicat',
    p04: 'Délicat',
    pr4: 'Délicat',
    '5': 'Laine / Soie',
    '05': 'Laine / Soie',
    p5: 'Laine / Soie',
    p05: 'Laine / Soie',
    pr5: 'Laine / Soie',
    '6': 'Rapide 30 min',
    '06': 'Rapide 30 min',
    p6: 'Rapide 30 min',
    p06: 'Rapide 30 min',
    pr6: 'Rapide 30 min',
    '7': 'Chemises',
    '07': 'Chemises',
    p7: 'Chemises',
    p07: 'Chemises',
    pr7: 'Chemises',
    '8': 'Éco 40-60',
    '08': 'Éco 40-60',
    p8: 'Éco 40-60',
    p08: 'Éco 40-60',
    pr8: 'Éco 40-60',
    '9': 'Linge foncé / Jeans',
    '09': 'Linge foncé / Jeans',
    p9: 'Linge foncé / Jeans',
    p09: 'Linge foncé / Jeans',
    pr9: 'Linge foncé / Jeans',
    '10': 'Couette / Linge de lit',
    p10: 'Couette / Linge de lit',
    pr10: 'Couette / Linge de lit',
    '11': 'Sport / Tenues de sport',
    p11: 'Sport / Tenues de sport',
    pr11: 'Sport / Tenues de sport',
    '12': 'Vapeur / Anti-allergies',
    p12: 'Vapeur / Anti-allergies',
    pr12: 'Vapeur / Anti-allergies',
    '13': 'Lavage à la main',
    p13: 'Lavage à la main',
    pr13: 'Lavage à la main',
    '14': 'Rinçage + Essorage',
    p14: 'Rinçage + Essorage',
    pr14: 'Rinçage + Essorage',
    '15': 'Essorage / Vidange',
    p15: 'Essorage / Vidange',
    pr15: 'Essorage / Vidange',
    '16': 'Nettoyage tambour',
    p16: 'Nettoyage tambour',
    pr16: 'Nettoyage tambour',

    // String Names & Enums
    cotton: 'Coton',
    cottons: 'Coton',
    'cotton eco': 'Coton Éco',
    'cottons eco': 'Coton Éco',
    'eco cotton': 'Coton Éco',
    'cotton eco 40 60': 'Coton Éco 40-60',
    synthetics: 'Synthétiques',
    synthetic: 'Synthétiques',
    'synthetic eco': 'Synthétique Éco',
    'minimum iron': 'Synthétique / Repassage facile',
    delicates: 'Délicat',
    delicate: 'Délicat',
    delicatessilk: 'Délicat / Soie',
    silk: 'Soie',
    silks: 'Soie',
    wool: 'Laine',
    woolens: 'Laine',
    woollens: 'Laine',
    quick: 'Rapide',
    quickwash: 'Lavage rapide',
    'quick wash': 'Lavage rapide',
    rapid: 'Rapide',
    express: 'Express',
    express20: 'Express 20 min',
    'express 20': 'Express 20 min',
    speed20: 'Rapide 20 min',
    speed30: 'Rapide 30 min',
    quick15: 'Rapide 15 min',
    quick30: 'Rapide 30 min',
    superquick1530: 'Rapide 15/30 min',
    mix: 'Mixte',
    mixed: 'Mixte',
    'mixed load': 'Linge mixte',
    mixedfabric: 'Linge mixte',
    'daily wash': 'Lavage quotidien',
    'automatic plus': 'Automatique plus',
    spin: 'Essorage',
    spinning: 'Essorage',
    'spin only': 'Essorage seul',
    'spin & drain': 'Essorage / Vidange',
    'spin/drain': 'Essorage / Vidange',
    'drain spin': 'Essorage / Vidange',
    'rinse & spin': 'Rinçage + Essorage',
    'rinse + spin': 'Rinçage + Essorage',
    'rinse spin': 'Rinçage + Essorage',
    'separate rinse': 'Rinçage seul',
    rinse: 'Rinçage',
    duvet: 'Couette',
    duvets: 'Couette',
    bedding: 'Linge de lit',
    bulky: 'Linge volumineux',
    down: 'Plumon / Doudoune',
    sport: 'Sport',
    sportswear: 'Tenues de sport',
    activewear: 'Tenues de sport',
    outdoor: "Vêtements d'extérieur",
    outerwear: "Vêtements d'extérieur",
    steam: 'Vapeur',
    'steam care': 'Soin vapeur',
    'allergy care': 'Anti-allergies',
    'hygiene steam': 'Hygiène vapeur',
    hygiene: 'Hygiène',
    'drum clean': 'Nettoyage tambour',
    'tub clean': 'Nettoyage cuve',
    'auto clean': 'Auto-nettoyage',
    'clean machine': 'Nettoyage machine',
    'drum clean plus': 'Nettoyage tambour +',
    'dark garments': 'Textiles foncés',
    'dark wash': 'Linge foncé',
    dark: 'Textiles foncés',
    jeans: 'Jeans',
    shirt: 'Chemises',
    shirts: 'Chemises',
    'shirts/blouses': 'Chemises / Chemisiers',
    'baby care': 'Linge bébé',
    babycare: 'Linge bébé',
    intensive: 'Intensif',
    'heavy duty': 'Intensif',
    stain: 'Anti-taches',
    stains: 'Anti-taches',
    'hand wash': 'Lavage à la main',
    handwash: 'Lavage à la main',
    eco: 'Éco',
    'eco 40 60': 'Éco 40-60',
    eco4060: 'Éco 40-60',
    eco50: 'Éco 50°',
    silent: 'Silence / Nuit',
    'silent wash': 'Lavage silencieux',
    'night wash': 'Lavage nuit',
    proofing: 'Imperméabilisation',
    starch: 'Amidonner',
  };

  if (translations[normalized]) {
    return translations[normalized];
  }

  // Fallback fuzzy keyword detection for complex code names
  if (normalized.includes('white') || normalized.includes('blanc')) {
    if (normalized.includes('cotton') || normalized.includes('coton')) return 'Coton blanc';
    if (normalized.includes('linen') || normalized.includes('bed') || normalized.includes('lit'))
      return 'Linge de lit blanc';
    return 'Blanc';
  }
  if (normalized.includes('color') || normalized.includes('couleur')) {
    if (normalized.includes('cotton') || normalized.includes('coton')) return 'Coton couleur';
    if (normalized.includes('linen') || normalized.includes('bed') || normalized.includes('lit'))
      return 'Linge de lit couleur';
    return 'Couleur';
  }
  if (
    normalized.includes('coloured') &&
    (normalized.includes('bed') || normalized.includes('linen'))
  ) {
    return 'Linge de lit couleur';
  }
  if (
    normalized.includes('bed') &&
    (normalized.includes('linen') || normalized.includes('sheet'))
  ) {
    return 'Linge de lit / Draps';
  }
  if (normalized.includes('cotton') || normalized.includes('coton')) {
    return normalized.includes('eco') ? 'Coton Éco' : 'Coton';
  }
  if (normalized.includes('synthetic') || normalized.includes('easy care')) {
    return 'Synthétiques';
  }
  if (normalized.includes('wool') || normalized.includes('laine')) {
    return 'Laine';
  }
  if (
    normalized.includes('silk') ||
    normalized.includes('soie') ||
    normalized.includes('delicate')
  ) {
    return 'Délicat / Soie';
  }
  if (normalized.includes('shirt') || normalized.includes('chemise')) {
    return 'Chemises';
  }
  if (normalized.includes('duvet') || normalized.includes('down')) {
    return 'Couette';
  }
  if (normalized.includes('sport') || normalized.includes('outdoor')) {
    return 'Sport';
  }
  if (
    normalized.includes('quick') ||
    normalized.includes('express') ||
    normalized.includes('rapid') ||
    normalized.includes('speed')
  ) {
    return 'Rapide';
  }
  if (normalized.includes('mix')) {
    return 'Mixte';
  }
  if (
    normalized.includes('steam') ||
    normalized.includes('vapeur') ||
    normalized.includes('allergy')
  ) {
    return 'Vapeur / Anti-allergies';
  }
  if (normalized.includes('drum') || normalized.includes('tub') || normalized.includes('clean')) {
    return 'Nettoyage tambour';
  }
  if (normalized.includes('dark') || normalized.includes('jeans')) {
    return 'Linge foncé / Jeans';
  }
  if (normalized.includes('spin') || normalized.includes('essorage')) {
    return 'Essorage';
  }
  if (normalized.includes('rinse') || normalized.includes('rincage')) {
    return 'Rinçage';
  }
  if (normalized.includes('drain') || normalized.includes('vidange')) {
    return 'Vidange';
  }
  if (normalized.includes('towel') || normalized.includes('serviette')) {
    return 'Serviettes';
  }

  // If normalized matches numeric pattern like "12" or "012", convert to "Programme 12"
  if (/^\d+$/.test(normalized)) {
    return `Programme ${parseInt(normalized, 10)}`;
  }

  // Clean raw string fallback (replace underscores with spaces & capitalize)
  const cleanRaw = raw
    .replace(/^lot_wash_/i, '')
    .replace(/^lot_/i, '')
    .replace(/^wash_/i, '')
    .replace(/_/g, ' ');
  return cleanRaw.charAt(0).toUpperCase() + cleanRaw.slice(1);
}

/**
 * Translates raw program phase values into French.
 *
 * @param {string | undefined} phase Raw program phase string
 * @returns {string | undefined} Translated French phase
 */
export function formatProgramPhase(phase: string | undefined): string | undefined {
  if (!phase || phase === '0') return undefined;
  const normalized = phase.trim().toLowerCase();
  const translations: Record<string, string> = {
    prewash: 'Prélavage',
    pre_wash: 'Prélavage',
    wash: 'Lavage',
    washing: 'Lavage',
    main_wash: 'Lavage principal',
    rinse: 'Rinçage',
    rinsing: 'Rinçage',
    spin: 'Essorage',
    spinning: 'Essorage',
    drain: 'Vidange',
    draining: 'Vidange',
    dry: 'Séchage',
    drying: 'Séchage',
    anti_crease: 'Anti-froissement',
    anticrease: 'Anti-froissement',
    finished: 'Terminé',
    end: 'Terminé',
    standby: 'En attente',
    idle: 'En attente',
  };
  return translations[normalized] || phase;
}

/**
 * Translates raw dry level values into French.
 *
 * @param {string | undefined} level Raw dry level string
 * @returns {string | undefined} Human readable French translation
 */
export function formatDryLevel(level: string | undefined): string | undefined {
  if (!level || level === '0' || level.toLowerCase() === 'off' || level.toLowerCase() === 'none')
    return undefined;
  const normalized = level.trim().toLowerCase();
  const translations: Record<string, string> = {
    cupboard_dry: 'Prêt à ranger',
    'cupboard dry': 'Prêt à ranger',
    iron_dry: 'Prêt à repasser',
    'iron dry': 'Prêt à repasser',
    extra_dry: 'Extra sec',
    'extra dry': 'Extra sec',
    gentle: 'Doux',
    low: 'Basse temp.',
  };
  return translations[normalized] || level;
}

/**
 * Translates raw water hardness values into French.
 *
 * @param {string | undefined} hardness Raw water hardness string
 * @returns {string | undefined} Human readable French translation
 */
export function formatWaterHardness(hardness: string | undefined): string | undefined {
  if (!hardness) return undefined;
  const normalized = hardness.trim().toLowerCase();
  const translations: Record<string, string> = {
    soft: 'Douce',
    medium: 'Moyenne',
    hard: 'Dure',
    very_hard: 'Très dure',
    'very hard': 'Très dure',
  };
  return translations[normalized] || hardness;
}
