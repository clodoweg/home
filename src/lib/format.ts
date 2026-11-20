/** format — Display formats shared by several widgets. */

/**
 * Formats minutes as a short duration, e.g. "45 min", "2h", "3h 08m".
 *
 * @param totalMinutes - Duration in minutes.
 * @returns The formatted duration ("0 min" for zero or less).
 */
export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 min';
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins.toString().padStart(2, '0')}m` : `${hours}h`;
}
