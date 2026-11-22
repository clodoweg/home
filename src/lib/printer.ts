/** printer — Status label and remaining time of the 3D printer, shared by its widget and the home screen. */

/**
 * Translates print status strings into French badge labels and styling.
 *
 * @param {unknown} status Raw status from Home Assistant
 * @returns {{ label: string; bgClass: string; textClass: string }} Translated status object
 */
export function formatPrintStatus(status: unknown): {
  label: string;
  bgClass: string;
  textClass: string;
} {
  if (typeof status !== 'string')
    return { label: 'Inconnu', bgClass: 'bg-muted', textClass: 'text-muted-foreground' };

  const norm = status.trim().toLowerCase();
  switch (norm) {
    case 'printing':
    case 'running':
    case 'prepare':
    case 'preparing':
      return {
        label: 'En cours',
        bgClass: 'bg-primary/20',
        textClass: 'text-primary',
      };
    case 'paused':
    case 'pause':
      return { label: 'En pause', bgClass: 'bg-warning/15', textClass: 'text-warning' };
    case 'finish':
    case 'finished':
    case 'success':
      return {
        label: 'Terminé',
        bgClass: 'bg-info/15',
        textClass: 'text-success',
      };
    case 'idle':
    case 'standby':
    case 'ready':
      return { label: 'En attente', bgClass: 'bg-secondary', textClass: 'text-muted-foreground' };
    case 'offline':
    case 'unavailable':
      return { label: 'Hors ligne', bgClass: 'bg-destructive/15', textClass: 'text-destructive' };
    default:
      return { label: status, bgClass: 'bg-secondary', textClass: 'text-foreground' };
  }
}

/**
 * Calculates remaining minutes from remaining time sensor value or end time ISO string.
 * Pure helper function isolated from React component render scope.
 *
 * @param {unknown} endTimeState End time ISO timestamp string
 * @param {unknown} remainingTimeState Direct remaining time sensor value
 * @param {string | undefined} unit Unit of measurement attribute
 * @param {unknown} printStatus Print status string to check if active
 * @returns {number} Remaining duration in minutes
 */
export function calculateRemainingMinutes(
  endTimeState?: unknown,
  remainingTimeState?: unknown,
  unit?: string,
  printStatus?: unknown,
): number {
  if (typeof printStatus === 'string') {
    const normStatus = printStatus.trim().toLowerCase();
    if (
      [
        'idle',
        'standby',
        'ready',
        'finish',
        'finished',
        'success',
        'offline',
        'unavailable',
      ].includes(normStatus)
    ) {
      return 0;
    }
  }

  if (
    remainingTimeState !== undefined &&
    remainingTimeState !== null &&
    remainingTimeState !== 'unknown' &&
    remainingTimeState !== 'unavailable'
  ) {
    const strVal = String(remainingTimeState).trim();

    if (strVal.includes(':')) {
      const parts = strVal.split(':').map((p) => Number(p));
      if (parts.length === 3 && parts.every((p) => !Number.isNaN(p))) {
        return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
      }
      if (parts.length === 2 && parts.every((p) => !Number.isNaN(p))) {
        return parts[0] * 60 + parts[1];
      }
    }

    const hMatches = strVal.match(/^(\d+)\s*h(?:eure|r)?s?(?:\s*(\d+)(?:m(?:ins?)?)?)?$/i);
    if (hMatches) {
      const hours = Number(hMatches[1]);
      const mins = hMatches[2] ? Number(hMatches[2]) : 0;
      return hours * 60 + mins;
    }

    const numVal = Number(strVal);
    if (!Number.isNaN(numVal) && numVal >= 0) {
      const normUnit = (unit || '').trim().toLowerCase();

      if (
        normUnit === 'h' ||
        normUnit === 'hr' ||
        normUnit === 'hrs' ||
        normUnit === 'hour' ||
        normUnit === 'hours' ||
        normUnit.startsWith('heure')
      ) {
        return Math.round(numVal * 60);
      }

      return Math.round(numVal);
    }
  }

  if (
    typeof endTimeState === 'string' &&
    endTimeState !== 'unknown' &&
    endTimeState !== 'unavailable'
  ) {
    const endTimeMs = new Date(endTimeState).getTime();
    const nowMs = Date.now();
    if (!Number.isNaN(endTimeMs) && endTimeMs > nowMs) {
      return Math.round((endTimeMs - nowMs) / 60000);
    }
  }

  return 0;
}
