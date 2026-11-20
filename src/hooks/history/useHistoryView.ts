/**
 * useHistoryView — État de l'onglet Historique : sous-onglet, granularité, période affichée,
 * comparaison avec l'année précédente et unité. Les choix (pas la période) sont gardés sur
 * l'appareil, comme un repli de widget.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import {
  periodContaining,
  previousYearPeriod,
  shiftPeriod,
  type Granularity,
  type Period,
} from '../../lib/history/period';

export type HistoryTab = 'energie' | 'appareils' | 'climat' | 'animaux' | 'securite' | 'croiser';
export type HistoryUnit = 'quantity' | 'cost';

interface StoredView {
  tab: HistoryTab;
  granularity: Granularity;
  compare: boolean;
  unit: HistoryUnit;
}

/** Device-only display choices (no user data): purged with the other `hsh` keys at logout. */
export const HISTORY_VIEW_STORAGE_KEY = 'hshHistoryView';

const DEFAULT_VIEW: StoredView = {
  tab: 'energie',
  granularity: 'month',
  compare: true,
  unit: 'quantity',
};
const TABS: readonly HistoryTab[] = [
  'energie',
  'appareils',
  'climat',
  'animaux',
  'securite',
  'croiser',
];
const GRANULARITIES: readonly Granularity[] = ['week', 'month', 'year', 'rolling'];

const readStoredView = (): StoredView => {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(HISTORY_VIEW_STORAGE_KEY) ?? '{}',
    ) as Partial<StoredView>;
    return {
      tab: TABS.includes(parsed.tab as HistoryTab) ? (parsed.tab as HistoryTab) : DEFAULT_VIEW.tab,
      granularity: GRANULARITIES.includes(parsed.granularity as Granularity)
        ? (parsed.granularity as Granularity)
        : DEFAULT_VIEW.granularity,
      compare: typeof parsed.compare === 'boolean' ? parsed.compare : DEFAULT_VIEW.compare,
      unit: parsed.unit === 'cost' ? 'cost' : 'quantity',
    };
  } catch {
    // Unreadable or blocked storage: the defaults.
    return DEFAULT_VIEW;
  }
};

/** What the history tab shows, and how to change it. */
export interface HistoryView extends StoredView {
  period: Period;
  /** The same period a year earlier. */
  previous: Period;
  /** The period shown contains today: no next one. */
  isCurrent: boolean;
  setTab: (tab: HistoryTab) => void;
  setGranularity: (granularity: Granularity) => void;
  setCompare: (compare: boolean) => void;
  setUnit: (unit: HistoryUnit) => void;
  /** Moves to the previous (-1) or next (1) period. */
  shift: (delta: number) => void;
}

/**
 * State of the history tab.
 *
 * @param now - Current instant (tests).
 * @returns The view and its setters.
 */
export function useHistoryView(now: Date = new Date()): HistoryView {
  const [stored, setStored] = useState<StoredView>(readStoredView);
  const [anchor, setAnchor] = useState<Date>(now);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_VIEW_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage full or blocked: the choice simply is not remembered.
    }
  }, [stored]);

  const period = useMemo(
    () => periodContaining(stored.granularity, anchor),
    [stored.granularity, anchor],
  );
  // The latest period that can be shown: the one in progress, or for a sliding year the 12
  // months before the current one.
  const latestStart = periodContaining(stored.granularity, now).start.getTime();
  const isCurrent = period.start.getTime() >= latestStart;

  const shift = useCallback(
    (delta: number) => {
      const next = shiftPeriod(period, delta);
      if (next.start.getTime() > latestStart) return;
      // A sliding year is found back from the month after it (see periodContaining).
      setAnchor(next.granularity === 'rolling' ? next.end : next.start);
    },
    [period, latestStart],
  );

  return {
    ...stored,
    period,
    previous: useMemo(() => previousYearPeriod(period), [period]),
    isCurrent,
    setTab: useCallback((tab: HistoryTab) => setStored((s) => ({ ...s, tab })), []),
    setGranularity: useCallback(
      (granularity: Granularity) => {
        // From the period in progress, stay in the present; otherwise the new view ends where
        // the one shown ended (« 2025 » then « 12 mois » shows January to December 2025).
        if (!isCurrent) {
          const lastDay = addDays(period.end, -1);
          setAnchor(granularity === 'rolling' ? period.end : lastDay);
        } else {
          setAnchor(now);
        }
        setStored((s) => ({ ...s, granularity }));
      },
      [isCurrent, period, now],
    ),
    setCompare: useCallback((compare: boolean) => setStored((s) => ({ ...s, compare })), []),
    setUnit: useCallback((unit: HistoryUnit) => setStored((s) => ({ ...s, unit })), []),
    shift,
  };
}
