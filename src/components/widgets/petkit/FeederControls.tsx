/** FeederControls — Refresh and manual feeding buttons of the Petkit feeder. */
import React from 'react';
import { RefreshCcw, Utensils } from 'lucide-react';
import { Skeleton } from '../../ui/Skeleton';
import { cn } from '../../../lib/utils';

interface FeederControlsProps {
  isRefreshing: boolean;
  isFeeding: boolean;
  onRefresh: () => void;
  onFeed: () => void;
}

/**
 * Refresh and manual feeding buttons of the feeder.
 *
 * @param props - Busy states and callbacks.
 * @returns The buttons.
 */
export const FeederControls = ({
  isRefreshing,
  isFeeding,
  onRefresh,
  onFeed,
}: FeederControlsProps) => (
  <div className="flex flex-row items-center gap-2 px-1">
    <button
      type="button"
      data-testid="petkit-sync"
      onClick={onRefresh}
      disabled={isRefreshing}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-muted p-3 transition-all',
        isRefreshing ? 'cursor-wait opacity-50' : 'hover:bg-secondary',
      )}
    >
      <RefreshCcw
        size={24}
        className={cn('text-muted-foreground', isRefreshing && 'animate-spin')}
      />
      <span className="text-xs font-medium text-muted-foreground">Actualiser</span>
    </button>

    <button
      type="button"
      data-testid="petkit-feed"
      onClick={onFeed}
      disabled={isFeeding}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-tangerine p-3 text-ink transition-all hover:opacity-90',
        isFeeding && 'cursor-wait opacity-50',
      )}
    >
      {isFeeding ? <Skeleton className="size-6 rounded-full" /> : <Utensils size={24} />}
      <span className="text-xs font-medium">Nourrir</span>
    </button>
  </div>
);
