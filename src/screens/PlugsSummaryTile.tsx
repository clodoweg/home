/**
 * PlugsSummaryTile — The wide "plugs" tile of the home screen: each plug the plugs widget shows,
 * with its state, its power when it is on, and an on/off button that works in one tap.
 */
import React from 'react';
import { ArrowUpRight, Monitor, Power, PowerOff, Tv } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { widgetHref } from '../constants/sections';
import { useHAState } from '../hooks/useHAState';
import type { HomeSummary } from '../lib/home-summary';
import { cn } from '../lib/utils';

const SUMMARY_TILE =
  'col-span-2 flex flex-col justify-start gap-5 rounded-tile p-5 md:col-span-3 md:p-6 xl:col-span-1';

const PLUG_ICON = { pc: Monitor, tv: Tv } as const;

const formatWatts = (watts: number) =>
  `${watts.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} W`;

interface PlugsSummaryTileProps {
  plugs: HomeSummary['plugs'];
}

/**
 * "Plugs" tile: one row per plug (name, state, power) with its on/off button. The state follows
 * the optimistic value of a pending switch, as in the widget.
 *
 * @param props - The plugs summary.
 * @returns The tile, or nothing when the house has no usable plug.
 */
export const PlugsSummaryTile = ({ plugs }: PlugsSummaryTileProps) => {
  const { loading, getEffectiveValue, performAction } = useHAState();
  if (!plugs) return null;

  const rows = plugs.map((plug) => ({ ...plug, on: getEffectiveValue(plug.entity) === 'on' }));
  const onCount = rows.filter((row) => row.on).length;
  const totalWatts = rows.reduce((sum, row) => sum + (row.on && row.watts ? row.watts : 0), 0);

  return (
    <section data-testid="home-summary-plugs" className={cn(SUMMARY_TILE, 'bg-lime text-ink')}>
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Prises</p>
          <p className="mt-0.5 text-xs font-medium">
            {onCount > 0
              ? `${onCount} ${onCount > 1 ? 'allumées' : 'allumée'}${totalWatts > 0 ? ` · ${formatWatts(totalWatts)}` : ''}`
              : 'Tout est éteint'}
          </p>
        </div>
        <a
          href={widgetHref('plugs')}
          aria-label="Ouvrir les prises"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-lime focus-visible:outline-hidden"
        >
          <ArrowUpRight size={20} aria-hidden="true" />
        </a>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {rows.map((row, index) => {
          const Icon = PLUG_ICON[row.id];
          return (
            <div
              key={row.id}
              data-testid={`home-plug-${row.id}`}
              className={cn(
                'flex flex-row items-center gap-3 rounded-2xl bg-ink/10 p-4',
                // A plug alone on its row takes the whole row rather than leave a hole.
                rows.length % 2 === 1 && index === rows.length - 1 && 'md:col-span-2',
              )}
            >
              <a
                href={widgetHref('plugs')}
                className="flex min-w-0 flex-1 flex-row items-center gap-3 rounded-2xl focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-hidden"
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    row.on ? 'bg-ink text-white' : 'bg-ink/10',
                  )}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{row.name}</span>
                  <span
                    data-testid={`home-plug-${row.id}-state`}
                    className="block font-display text-2xl leading-tight font-bold tracking-tight"
                  >
                    {row.on ? (row.watts !== null ? formatWatts(row.watts) : 'Allumée') : 'Éteinte'}
                  </span>
                </span>
              </a>
              <Button
                data-testid={`home-plug-${row.id}-toggle`}
                label={row.on ? 'Éteindre' : 'Allumer'}
                aria-label={`${row.on ? 'Éteindre' : 'Allumer'} ${row.name}`}
                aria-pressed={row.on}
                icon={row.on ? PowerOff : Power}
                loading={loading === row.entity.entity_id}
                onClick={() =>
                  performAction(
                    row.entity,
                    'switch',
                    row.on ? 'turn_off' : 'turn_on',
                    {},
                    row.on ? 'off' : 'on',
                  )
                }
                className={cn(
                  'shrink-0',
                  row.on
                    ? 'bg-white text-ink hover:bg-white/90 active:bg-white/80'
                    : 'bg-ink text-white hover:bg-ink/90 active:bg-ink/80',
                )}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
};
