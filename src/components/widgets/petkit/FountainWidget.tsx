/**
 * FountainWidget — Petkit CTW fountain status, activity stats, and drink timeline.
 */
import React, { memo, useMemo } from 'react';
import { Droplets, Activity, AlertCircle, Battery, Zap } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '../../ui/Skeleton';
import { useUserProfile } from '../../../context/UserContext';
import { BaseWidget, WidgetHighlight } from '../BaseWidget';
import { PetKitData } from '../../../services/api';
import { WIDGET_CONFIG } from '../../../constants/widgets';
import { cn } from '../../../lib/utils';
import { WidgetDateNav } from '../../ui/WidgetDateNav';
import { Panel } from '../../ui/Panel';
import { logger } from '../../../lib/logger';
import { useDayNavigation } from '../../../hooks/useDayNavigation';
import { findPetkitDevice } from '../../../hooks/petkit/feeder-records';
import { useFountainDay } from '../../../hooks/petkit/useFountainDay';

const config = WIDGET_CONFIG.fountain;

interface FountainWidgetProps {
  data: PetKitData | null;
  loading?: boolean;
}

/** Visit length as Petkit shows it, e.g. `2Min5s`. */
const formatVisitDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}Min${seconds % 60}s`;
};

/**
 * Petkit fountain state and the pet's visits per day.
 *
 * @param props - Petkit data and loading state.
 * @returns The widget, or nothing without a fountain.
 */
export const FountainWidget = memo(function FountainWidget({ data, loading }: FountainWidgetProps) {
  const { canAccessHistory } = useUserProfile();
  const { selectedDate, goToPreviousDay, goToNextDay } = useDayNavigation();
  const dateLabel = isToday(selectedDate)
    ? "Aujourd'hui"
    : format(selectedDate, 'd MMM', { locale: fr });

  const device = useMemo(
    () => findPetkitDevice(data?.devices, ['ctw', 'fountain']),
    [data?.devices],
  );
  const {
    filterLife,
    waterLevelStatus,
    mode,
    battery,
    isPlugged,
    activity,
    totalDrunkMinutes,
    latestVisits,
  } = useFountainDay(data, device, selectedDate);
  const totalPassages = activity.total;

  if (!device && !loading) {
    if (data) {
      logger.info(
        `[FountainWidget] No device found and not loading. Devices available:`,
        data.devices.map((d) => `${d.name} (${d.deviceType})`),
      );
    }
    return null;
  }

  return (
    <BaseWidget
      id="fountain"
      title={config.title}
      subtitle={[
        <span key="water-status">
          <span className="text-xs text-muted-foreground">Niveau d&apos;eau </span>
          <WidgetHighlight colorClass={waterLevelStatus === 0 ? 'text-success' : 'text-warning'}>
            {waterLevelStatus === 0 ? 'normal' : 'bas'}
          </WidgetHighlight>
        </span>,
        <WidgetHighlight key="passages" colorClass="text-info">
          {totalPassages} {totalPassages > 1 ? 'passages' : 'passage'}
        </WidgetHighlight>,
        `Filtre ${filterLife}%`,
      ]}
      icon={config.icon}
    >
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Skeleton className="h-20 w-full" />
        </div>
      ) : device ? (
        <div className="flex flex-col gap-6 py-4">
          <WidgetDateNav
            date={selectedDate}
            onPrev={goToPreviousDay}
            onNext={goToNextDay}
            canAccessHistory={!!canAccessHistory}
          />

          <div className="flex flex-row gap-2">
            <Panel className="flex-1 rounded-2xl">
              <div className="mb-2 flex flex-row items-start justify-between">
                <span className="text-xs font-medium text-muted-foreground">Niveau d&apos;eau</span>
                <AlertCircle
                  size={14}
                  className={waterLevelStatus === 0 ? 'text-success' : 'text-destructive'}
                />
              </div>
              <p
                className={cn(
                  'mb-1 text-xl font-bold',
                  waterLevelStatus === 0 ? 'text-foreground' : 'text-destructive',
                )}
              >
                {waterLevelStatus === 0 ? 'Normal' : 'Bas'}
              </p>
              <p className="text-[10px] font-medium tracking-wider text-info uppercase">
                {mode === 2 ? 'Mode Intelligent' : 'Mode Normal'}
              </p>
            </Panel>

            <Panel className="flex-1 rounded-2xl">
              <div className="mb-1 flex flex-row items-start justify-between">
                <span className="text-xs font-medium text-muted-foreground">Alimentation</span>
                {isPlugged ? (
                  <Zap size={14} className="text-warning" />
                ) : (
                  <Battery size={14} className="text-success" />
                )}
              </div>
              <p className="text-lg font-bold text-foreground">
                {isPlugged ? 'Secteur' : battery !== undefined ? `${battery}%` : 'Batterie'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {isPlugged ? 'Stable' : 'Sur batterie'}
              </p>
            </Panel>

            <Panel className="flex-1 rounded-2xl">
              <div className="mb-2 flex flex-row items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{dateLabel}</span>
                <Activity size={14} className="text-info" />
              </div>
              <div className="flex flex-row items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">{totalDrunkMinutes || 0}</span>
                <span className="text-sm text-muted-foreground">min</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{totalPassages} passages</p>
            </Panel>
          </div>

          <div>
            <p className="mb-3 pl-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Répartition de la journée
            </p>
            {totalPassages > 0 ? (
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Matin (6h-12h)', count: activity.morning, icon: '🌅' },
                  { label: 'Après-midi (12h-18h)', count: activity.afternoon, icon: '☀️' },
                  { label: 'Soir & Nuit', count: activity.night, icon: '🌙' },
                ]
                  .filter((p) => p.count > 0)
                  .map((p) => (
                    <Panel key={p.label} className="flex flex-row items-center rounded-xl p-3">
                      <span className="mr-3 text-lg">{p.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{p.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.count} passage(s) détecté(s)
                        </p>
                      </div>
                    </Panel>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-muted p-8">
                <Activity size={24} className="mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Aucune activité enregistrée</p>
              </div>
            )}
          </div>

          {latestVisits.length > 0 && (
            <div className="mt-6">
              <p className="mb-4 pl-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">
                Événements
              </p>
              <div>
                {latestVisits.map((r, idx) => {
                  const hours = Math.floor((r.dayTime || 0) / 3600);
                  const minutes = Math.floor(((r.dayTime || 0) % 3600) / 60);
                  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                  const rid = `fountain-event-${idx}`;

                  return (
                    <div key={rid} className="flex flex-row gap-4">
                      <div className="flex h-7 w-12 items-center justify-end">
                        <span className="text-base font-bold text-foreground">{timeStr}</span>
                      </div>

                      <div className="relative flex-1 border-l-2 border-border pb-8 pl-6">
                        <div className="absolute top-0 left-[-14px] flex size-7 items-center justify-center rounded-full bg-aqua ring-4 ring-background">
                          <Droplets size={14} className="text-white" />
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex h-7 items-center">
                            <p className="text-sm leading-tight font-medium text-foreground">
                              L&apos;animal est venu boire de l&apos;eau
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            et est resté {formatVisitDuration(r.stayTime || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center p-8">
          <Droplets size={32} className="mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Aucune fontaine trouvée</p>
        </div>
      )}
    </BaseWidget>
  );
});
