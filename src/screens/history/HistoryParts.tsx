/** HistoryParts — Briques communes des vues de l'onglet Historique : carte, chiffre clé, écart, vide. */
import React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { TONE_CLASSES, type Tone } from '../../constants/widgets';
import { cn } from '../../lib/utils';
import type { IconComponent } from '../../types/icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { decimalsFor, formatNumber } from './format';

interface HistoryCardProps {
  title: string;
  icon: IconComponent;
  tone: Tone;
  subtitle?: string;
  testId: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * A card of the history tab: domain chip, title, content.
 *
 * @param props - Title, icon, tone, subtitle, test id and content.
 * @returns The card.
 */
export const HistoryCard = ({
  title,
  icon: Icon,
  tone,
  subtitle,
  testId,
  className,
  children,
}: HistoryCardProps) => (
  <section
    data-testid={testId}
    className={cn('min-w-0 rounded-tile bg-card p-4 sm:p-5', className)}
  >
    <header className="mb-4 flex flex-row items-center gap-3">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          TONE_CLASSES[tone],
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <h2 className="truncate font-display text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </span>
    </header>
    {children}
  </section>
);

/**
 * Change against last year, as a small badge. For consumption a rise is bad (red); for
 * neutral counters it is only shown.
 *
 * @param props - Change in percent, and whether lower is better.
 * @returns The badge, or nothing when unknown.
 */
const DeltaBadge = ({
  percent,
  lowerIsBetter = true,
}: {
  percent: number | null;
  lowerIsBetter?: boolean;
}) => {
  if (percent === null || !Number.isFinite(percent)) return null;
  const stable = Math.abs(percent) < 2;
  const Icon = stable ? ArrowRight : percent > 0 ? ArrowUpRight : ArrowDownRight;
  const good = stable ? null : lowerIsBetter ? percent < 0 : null;
  return (
    <span
      data-testid="history-delta"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
        good === null
          ? 'bg-secondary text-muted-foreground'
          : good
            ? 'bg-success/15 text-success'
            : 'bg-destructive/15 text-destructive',
      )}
    >
      <Icon size={12} aria-hidden="true" />
      {stable ? 'stable' : `${percent > 0 ? '+' : ''}${formatNumber(percent, 0)} %`}
    </span>
  );
};

interface StatProps {
  label: string;
  value: number | null;
  unit: string;
  /** Prefix « ≈ » for an estimate (costs). */
  approximate?: boolean;
  percent?: number | null;
  lowerIsBetter?: boolean;
  /** What the change compares (« vs nov. 2025 »). */
  comparedTo?: string;
  testId?: string;
}

/**
 * A key figure with its change against last year.
 *
 * @param props - Label, value, unit and change.
 * @returns The figure.
 */
export const Stat = ({
  label,
  value,
  unit,
  approximate,
  percent = null,
  lowerIsBetter,
  comparedTo,
  testId,
}: StatProps) => (
  <div data-testid={testId} className="min-w-0 rounded-2xl bg-muted p-3">
    <p className="truncate text-xs text-muted-foreground">{label}</p>
    <p className="font-display text-2xl font-bold tracking-tight text-foreground">
      {value === null
        ? '—'
        : `${approximate ? '≈ ' : ''}${formatNumber(value, decimalsFor(value))}`}
      <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>
    </p>
    {percent !== null && (
      <p className="mt-1 flex flex-row flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <DeltaBadge percent={percent} lowerIsBetter={lowerIsBetter} />
        {comparedTo && <span className="truncate">{comparedTo}</span>}
      </p>
    )}
  </div>
);

/**
 * What a card shows while its data loads: a block of the chart's height.
 *
 * @param props - Height of the content.
 * @returns The placeholder.
 */
export const ChartSkeleton = ({ height = 200 }: { height?: number }) => (
  <Skeleton className="w-full rounded-xl" style={{ height }} />
);

/**
 * Message in place of a chart without data.
 *
 * @param props - Text.
 * @returns The message.
 */
export const EmptyChart = ({ children }: { children: React.ReactNode }) => (
  <p
    data-testid="history-empty"
    className="rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground"
  >
    {children}
  </p>
);

/**
 * Row of options where one is chosen (period, unit, tab).
 *
 * @param props - Options, value, change handler, accessible label and test id prefix.
 * @returns The control.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  testIdPrefix,
  className,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  testIdPrefix: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-row gap-1 rounded-full bg-card p-1', className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={`${testIdPrefix}-${option.value}`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-9 flex-1 rounded-full px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
            option.value === value
              ? 'bg-primary font-semibold text-primary-foreground'
              : 'font-medium text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
