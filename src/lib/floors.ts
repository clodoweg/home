/** floors — Ordering and grouping of rooms by floor, shared by the lights and temperature widgets. */

/** Floor shown for rooms whose floor Home Assistant does not know. */
export const OTHER_FLOOR = 'Autres';

/** Natural order of the floors when the user has not set one (matched as substrings). */
const NATURAL_FLOOR_ORDER = [
  'sous-sol',
  'cave',
  'rdc',
  'rez-de-chaussée',
  '1er',
  'etage',
  'étage',
  '2ème',
  'exterieur',
  'extérieur',
];

/**
 * Rank of a floor in the natural order: known floors first, then unknown names, then no floor.
 *
 * @param floor - Floor name from Home Assistant.
 * @returns The rank (lower comes first).
 */
export function floorPriority(floor?: string): number {
  if (!floor) return 999;
  const name = floor.toLowerCase();
  const index = NATURAL_FLOOR_ORDER.findIndex((known) => name.includes(known));
  return index === -1 ? 900 : index;
}

/**
 * Compares two names by the user's saved order; names in the order come first.
 *
 * @param a - First name.
 * @param b - Second name.
 * @param order - Saved order.
 * @returns The comparison, or null when neither name is in the order.
 */
export function compareByUserOrder(a: string, b: string, order: string[]): number | null {
  const indexA = order.indexOf(a);
  const indexB = order.indexOf(b);
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return null;
}

/**
 * Compares two floors: user's order first, then natural order, then alphabetical.
 *
 * @param a - First floor (undefined when unknown).
 * @param b - Second floor.
 * @param floorOrder - Floor order saved by the user.
 * @returns 0 for the same floor, negative when `a` comes first.
 */
export function compareFloors(a: string | undefined, b: string | undefined, floorOrder: string[]) {
  const floorA = a || OTHER_FLOOR;
  const floorB = b || OTHER_FLOOR;
  if (floorA === floorB) return 0;
  const byUser = compareByUserOrder(floorA, floorB, floorOrder);
  if (byUser !== null) return byUser;
  const priorityA = floorPriority(a);
  const priorityB = floorPriority(b);
  if (priorityA !== priorityB) return priorityA - priorityB;
  return floorA.localeCompare(floorB);
}

/**
 * Groups items by floor, keeping their order.
 *
 * @param items - Items already sorted by floor.
 * @returns One group per floor, in order of first appearance.
 */
export function groupByFloor<T extends { floor?: string }>(
  items: T[],
): { floor: string; items: T[] }[] {
  const groups: { floor: string; items: T[] }[] = [];
  for (const item of items) {
    const floor = item.floor || OTHER_FLOOR;
    let group = groups.find((g) => g.floor === floor);
    if (!group) {
      group = { floor, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/**
 * Whether a floor is outdoors (outdoor thresholds apply).
 *
 * @param floor - Floor name.
 * @returns True for "Extérieur" (with or without accent).
 */
export const isOutdoorFloor = (floor?: string): boolean => {
  const name = floor?.toLowerCase();
  return !!name && (name.includes('exterieur') || name.includes('extérieur'));
};
