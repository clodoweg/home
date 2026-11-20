/** SpaTemperature — Current and target spa temperature with the setpoint slider. */
import React from 'react';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';

interface SpaTemperatureProps {
  current: number;
  target: number;
  isPowerOn: boolean;
  hasError: boolean;
  onSetTemperature: (val: number) => void;
}

/**
 * Current and target spa temperature with the setpoint slider.
 *
 * @param props - Temperatures, state and setpoint callback.
 * @returns The temperature block.
 */
export const SpaTemperature = ({
  current,
  target,
  isPowerOn,
  onSetTemperature,
}: SpaTemperatureProps) => {
  const [dragValue, setDragValue] = React.useState<number | null>(null);

  return (
    <div>
      <div className="mb-4 flex flex-row items-end justify-between">
        <div>
          <p className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Actuelle
          </p>
          <div className="flex flex-row items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-foreground">{current}</span>
            <span className="text-lg font-medium text-muted-foreground">°C</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <p className="mb-0.5 text-[10px] tracking-wider text-muted-foreground uppercase">Cible</p>
          <p className="text-sm font-semibold text-foreground">{dragValue ?? target}°C</p>
        </div>
      </div>

      <div
        className={cn(
          'mt-3 rounded-xl bg-muted p-4',
          !isPowerOn && 'pointer-events-none opacity-50',
        )}
      >
        <div className="mb-4 px-1">
          <Slider
            testID="spa-temp-slider"
            value={dragValue ?? target}
            min={20}
            max={40}
            step={1}
            onValueChange={(vals) => setDragValue(vals[0])}
            onSlidingComplete={(vals) => {
              setDragValue(null);
              onSetTemperature(vals[0]);
            }}
          />
        </div>
      </div>
    </div>
  );
};
