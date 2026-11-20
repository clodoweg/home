/**
 * WidgetDateNav — Date navigator used by history-enabled widgets
 * (electricity, gas, feeder timeline). Shows the selected day with
 * prev/next arrows; disables next when on today and hides the whole
 * bar for users without history access.
 */
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../../lib/utils';

interface WidgetDateNavProps {
  date: Date;
  onPrev: () => void;
  onNext: () => void;
  canAccessHistory: boolean;
  lastSyncedAt?: number | string | Date;
  className?: string;
}

/**
 * Previous/next day selector of a widget with history.
 *
 * @param props - Selected day, navigation callbacks and history right.
 * @returns The selector, or nothing without the history right.
 */
export const WidgetDateNav = ({
  date,
  onPrev,
  onNext,
  canAccessHistory,
  lastSyncedAt,
  className,
}: WidgetDateNavProps) => {
  if (!canAccessHistory) return null;

  const getDateLabel = (d: Date) => {
    if (isToday(d)) return "Aujourd'hui";
    if (isYesterday(d)) return 'Hier';
    const formatted = format(d, 'EEEE d MMMM', { locale: fr });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const isDateToday = isToday(date);

  return (
    <div
      className={cn(
        'flex flex-row items-center justify-between rounded-xl bg-muted p-2 px-4',
        className,
      )}
    >
      <button type="button" onClick={onPrev} className="p-2 text-foreground disabled:opacity-30">
        <ChevronLeft size={20} />
      </button>

      <div className="flex flex-col items-center">
        <div className="flex flex-row items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{getDateLabel(date)}</span>
          {lastSyncedAt && isDateToday && (
            <span className="text-[10px] font-medium text-muted-foreground italic">
              (Màj {format(new Date(lastSyncedAt), 'HH:mm', { locale: fr })})
            </span>
          )}
        </div>
        {isDateToday && (
          <span className="text-[10px] font-medium tracking-tighter text-info uppercase">
            En direct
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={isDateToday}
        className="p-2 text-foreground disabled:opacity-30"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};
