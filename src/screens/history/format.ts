/** history/format — Mise en forme des nombres de l'onglet Historique (français). */
const formatters = new Map<number, Intl.NumberFormat>();

/**
 * A number in French notation.
 *
 * @param value - Number.
 * @param decimals - Digits after the comma.
 * @returns E.g. « 1 234,5 ».
 */
export function formatNumber(value: number, decimals = 1): string {
  let formatter = formatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
    formatters.set(decimals, formatter);
  }
  return formatter.format(value);
}

/**
 * Decimals suited to a magnitude: 1 234 kWh, 12,3 kWh, 0,42 kWh.
 *
 * @param value - Number to show.
 * @returns Digits after the comma.
 */
export const decimalsFor = (value: number): number =>
  Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
