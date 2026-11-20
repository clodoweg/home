/** SpaControls — Power, heating, filter and bubbles buttons of the spa. */
import React from 'react';
import { Filter, Flame, Power, Waves } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface SpaControlsProps {
  isPowerOn: boolean;
  isHeatOn: boolean;
  isFilterOn: boolean;
  bubblesState: string;
  onTogglePower: () => void;
  onToggleHeat: () => void;
  onToggleFilter: () => void;
  onToggleBubbles: () => void;
}

/**
 * Rangée de boutons du spa : alimentation, chauffage, filtration et bulles.
 * @param props - États courants et callbacks de bascule de chaque fonction.
 * @returns La rangée de contrôles.
 */
export const SpaControls = ({
  isPowerOn,
  isHeatOn,
  isFilterOn,
  bubblesState,
  onTogglePower,
  onToggleHeat,
  onToggleFilter,
  onToggleBubbles,
}: SpaControlsProps) => {
  const isBubblesOn = bubblesState.toLowerCase() !== 'off';

  return (
    <div className="flex flex-row justify-between gap-2">
      <button
        type="button"
        data-testid="spa-toggle-power"
        onClick={onTogglePower}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border p-3 transition-all',
          isPowerOn ? 'border-transparent bg-lime text-ink' : 'border-transparent bg-muted',
        )}
      >
        <Power size={24} className={isPowerOn ? 'text-current' : 'text-muted-foreground'} />
        <span
          className={cn(
            'text-xs font-medium',
            isPowerOn ? 'text-current' : 'text-muted-foreground',
          )}
        >
          {isPowerOn ? 'Marche' : 'Arrêt'}
        </span>
      </button>

      <button
        type="button"
        data-testid="spa-toggle-heat"
        onClick={onToggleHeat}
        disabled={!isPowerOn}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border p-3 transition-all',
          isHeatOn ? 'border-transparent bg-coral text-ink' : 'border-transparent bg-muted',
          !isPowerOn && 'opacity-50',
        )}
      >
        <Flame size={24} className={isHeatOn ? 'text-current' : 'text-muted-foreground'} />
        <span
          className={cn('text-xs font-medium', isHeatOn ? 'text-current' : 'text-muted-foreground')}
        >
          Chauffage
        </span>
      </button>

      <button
        type="button"
        data-testid="spa-toggle-filter"
        onClick={onToggleFilter}
        disabled={!isPowerOn}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border p-3 transition-all',
          isFilterOn ? 'border-transparent bg-cobalt text-white' : 'border-transparent bg-muted',
          !isPowerOn && 'opacity-50',
        )}
      >
        <Filter size={24} className={isFilterOn ? 'text-current' : 'text-muted-foreground'} />
        <span
          className={cn(
            'text-xs font-medium',
            isFilterOn ? 'text-current' : 'text-muted-foreground',
          )}
        >
          Filtration
        </span>
      </button>

      <button
        type="button"
        data-testid="spa-toggle-bubbles"
        onClick={onToggleBubbles}
        disabled={!isPowerOn}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border p-3 transition-all',
          isBubblesOn ? 'border-transparent bg-lilac text-ink' : 'border-transparent bg-muted',
          !isPowerOn && 'opacity-50',
        )}
      >
        <Waves size={24} className={isBubblesOn ? 'text-current' : 'text-muted-foreground'} />
        <div className="flex flex-col items-center">
          <span
            className={cn(
              'text-xs font-medium',
              isBubblesOn ? 'text-current' : 'text-muted-foreground',
            )}
          >
            Bulles
          </span>
          <span className="text-[10px] capitalize opacity-80">
            {bubblesState === 'off' ? 'Arrêt' : bubblesState}
          </span>
        </div>
      </button>
    </div>
  );
};
