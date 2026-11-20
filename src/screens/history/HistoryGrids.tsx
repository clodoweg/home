/**
 * HistoryGrids — Couleurs des séries de l'onglet Historique, carte horaire de l'électricité et
 * calendrier de l'année (des grilles CSS, sans recharts).
 */
import React from 'react';
import { cn } from '../../lib/utils';
import { formatNumber } from './format';

/** Colours of the history series: semantic tokens, readable in both themes. */
export const SERIES_COLORS = {
  electricity: 'hsl(var(--warning))',
  gas: 'hsl(var(--info))',
  water: 'hsl(var(--success))',
  temperature: 'hsl(var(--destructive))',
  humidity: 'hsl(var(--info))',
  neutral: 'hsl(var(--foreground))',
} as const;

/** Palette of the free comparison, one colour per series. */
export const CROSS_COLORS = [SERIES_COLORS.electricity, SERIES_COLORS.gas, SERIES_COLORS.water];

/**
 * Hour by day grid of the electricity: the darker the cell, the more energy that hour.
 *
 * @param props - Day labels, cells in kWh and the max of the colour scale.
 * @returns The grid.
 */
export const HourHeatmap = ({
  days,
  cells,
  max,
}: {
  days: string[];
  cells: (number | null)[][];
  max: number;
}) => (
  <div className="overflow-x-auto" data-testid="history-electricity-heatmap">
    <div
      className="grid min-w-[480px] gap-px"
      style={{ gridTemplateColumns: `3.25rem repeat(24, minmax(0, 1fr))` }}
    >
      <span />
      {Array.from({ length: 24 }, (_, h) => (
        <span key={h} className="text-center text-[9px] text-muted-foreground">
          {h % 3 === 0 ? `${h}h` : ''}
        </span>
      ))}
      {days.map((day, row) => (
        <React.Fragment key={day}>
          <span className="pr-1 text-right text-[10px] leading-4 text-muted-foreground">
            {day.slice(8)}/{day.slice(5, 7)}
          </span>
          {cells[row].map((value, h) => (
            <span
              // Fixed 24 columns: the hour is the identity of the cell.
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={h}
              title={
                value === null
                  ? undefined
                  : `${day.slice(8)}/${day.slice(5, 7)} ${h}h : ${formatNumber(value, 2)} kWh`
              }
              className={cn('h-4 rounded-[2px]', value === null ? 'bg-muted' : 'bg-warning')}
              style={
                value === null || max === 0 ? undefined : { opacity: 0.12 + 0.88 * (value / max) }
              }
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  </div>
);

/**
 * The days of a year as a calendar, one column per week, coloured by consumption.
 *
 * @param props - Weeks of seven days, the max of the scale and the unit.
 * @returns The calendar.
 */
export const YearCalendar = ({
  weeks,
  max,
  unit,
}: {
  weeks: ({ date: string; value: number | null } | null)[][];
  max: number;
  unit: string;
}) => (
  <div className="overflow-x-auto" data-testid="history-electricity-calendar">
    <div className="flex min-w-[640px] flex-row gap-px">
      {weeks.map((week) => (
        <div key={week.find(Boolean)?.date} className="flex flex-1 flex-col gap-px">
          {week.map((cell, i) =>
            cell === null ? (
              // A blank before the first day or after the last one: its row is its identity.
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <span key={`blank-${i}`} className="aspect-square" />
            ) : (
              <span
                key={cell.date}
                title={
                  cell.value === null
                    ? cell.date
                    : `${cell.date} : ${formatNumber(cell.value, 1)} ${unit}`
                }
                className={cn(
                  'aspect-square rounded-[2px]',
                  cell.value === null ? 'bg-muted' : 'bg-warning',
                )}
                style={
                  cell.value === null || max === 0
                    ? undefined
                    : { opacity: 0.12 + 0.88 * (cell.value / max) }
                }
              />
            ),
          )}
        </div>
      ))}
    </div>
  </div>
);
