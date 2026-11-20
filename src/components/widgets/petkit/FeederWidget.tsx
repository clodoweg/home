/**
 * FeederWidget — Petkit D4 feeder with per-bac consumption, meal plan, and timeline.
 */
import React, { memo, useMemo, useState } from 'react';
import { Utensils } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '../../ui/Skeleton';
import { BaseWidget, WidgetHighlight } from '../BaseWidget';
import { PetKitData } from '../../../services/api';
import { useUserProfile } from '../../../context/UserContext';
import { cn } from '../../../lib/utils';
import { WIDGET_CONFIG } from '../../../constants/widgets';
import { FeederControls } from './FeederControls';
import { FeederTimeline } from './FeederTimeline';
import { useFeederDayRecords } from '../../../hooks/petkit/useFeederDayRecords';
import { useFeederDailyTotals } from '../../../hooks/petkit/useFeederDailyTotals';
import { useOptimisticFeed } from '../../../hooks/petkit/useOptimisticFeed';
import { WidgetDateNav } from '../../ui/WidgetDateNav';
import { Panel } from '../../ui/Panel';
import { logger } from '../../../lib/logger';
import { useDayNavigation } from '../../../hooks/useDayNavigation';
import type { TimelineFilter } from '../../../hooks/petkit/useFeederDayRecords';
import { findPetkitDevice, totalRations } from '../../../hooks/petkit/feeder-records';

const config = WIDGET_CONFIG.feeder;

/** Food level of a bowl as reported by the feeder: 0 empty, 1 low, 2 ok. */
const FOOD_STATUS: Record<number, { label: string; className: string }> = {
  0: { label: 'Vide', className: 'text-destructive' },
  1: { label: 'Faible', className: 'text-warning' },
  2: { label: 'Ok', className: 'text-success' },
};

const getDateLabel = (date: Date) => {
  if (isToday(date)) return "Aujourd'hui";
  if (isYesterday(date)) return 'Hier';
  return format(date, 'EEEE d MMMM', { locale: fr });
};

const rationsWord = (count: number) => (count > 1 ? 'rations distribuées' : 'ration distribuée');

/** Rations served on a day, against the planned ones. */
const RationsCard = ({
  title,
  served,
  planned,
}: {
  title: string;
  served: number;
  planned: number;
}) => (
  <Panel className="flex flex-col items-center justify-center rounded-2xl bg-muted p-3 text-center">
    <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
      {title}
    </span>
    <div className="mt-1 flex items-baseline gap-1">
      <span className="text-2xl font-bold text-foreground">{served}</span>
      {planned > 0 && (
        <span className="text-xs font-medium text-muted-foreground">/ {planned}</span>
      )}
    </div>
    <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
      {rationsWord(served)}
    </span>
  </Panel>
);

/** Rations eaten from one bowl, with its food level. */
const BowlRow = ({
  name,
  dotClassName,
  foodStatus,
  rations,
}: {
  name: string;
  dotClassName: string;
  foodStatus?: number;
  rations: number;
}) => {
  const status = foodStatus === undefined ? undefined : FOOD_STATUS[foodStatus];
  return (
    <div className="flex flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-3">
        <div className={cn('size-2 rounded-full', dotClassName)} />
        <div>
          <p className="font-medium text-foreground">{name}</p>
          <p
            className={cn(
              'text-[10px] font-bold tracking-tight uppercase',
              status?.className ?? 'text-muted-foreground',
            )}
          >
            {status?.label ?? ''}
          </p>
        </div>
      </div>
      <div className="flex flex-row items-baseline gap-1">
        <span className="text-2xl font-bold text-foreground">{rations}</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase">rations</span>
      </div>
    </div>
  );
};

interface FeederWidgetProps {
  data: PetKitData | null;
  loading?: boolean;
  onRefresh?: () => void;
}

/**
 * Petkit feeder: rations, bowls, manual feeding and timeline.
 *
 * @param props - Petkit data, loading state and refresh callback.
 * @returns The widget, or nothing without a feeder.
 */
export const FeederWidget = memo(function FeederWidget({
  data,
  loading,
  onRefresh,
}: FeederWidgetProps) {
  const { token, canAccessHistory } = useUserProfile();
  const { selectedDate, goToPreviousDay, goToNextDay } = useDayNavigation();
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const device = useMemo(() => findPetkitDevice(data?.devices, ['d4', 'feeder']), [data?.devices]);

  const { pendingFeedings, isFeeding, handleFeed } = useOptimisticFeed({ device, token, data });

  const { recordsForDay, filteredRecords, counts, feedEventsForDay } = useFeederDayRecords({
    data,
    pendingFeedings,
    selectedDate,
    timelineFilter,
  });

  const {
    todayTotalRations,
    todayPlanTotal,
    yesterdayTotalRations,
    yesterdayPlanTotal,
    todayColorClass,
  } = useFeederDailyTotals({
    data,
    device,
    pendingFeedings,
  });

  // Fallback to daily aggregates when per-event history is unavailable
  // (e.g. user has no 'history' permission). Only apply for today when no feed events are loaded.
  const fallbackAmount1 = isToday(selectedDate) ? (device?.dailyFeed?.realAmountTotal1 ?? 0) : 0;
  const fallbackAmount2 = isToday(selectedDate) ? (device?.dailyFeed?.realAmountTotal2 ?? 0) : 0;

  const consumedAmount1 =
    feedEventsForDay.length > 0 ? totalRations(feedEventsForDay, 1) : fallbackAmount1;
  const consumedAmount2 =
    feedEventsForDay.length > 0 ? totalRations(feedEventsForDay, 2) : fallbackAmount2;

  const handleRefresh = async () => {
    if (!token) return;
    setIsRefreshing(true);
    try {
      // Petkit data is computed live from Home Assistant by the back: refetching is enough
      if (onRefresh) {
        await onRefresh();
      } else {
        window.location.reload();
      }
    } catch (e) {
      logger.error('Failed to refresh PetKit data:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const subtitleNode = useMemo(
    () =>
      device
        ? [
            <span key="today" className="font-semibold text-foreground">
              Aujourd'hui :{' '}
              <WidgetHighlight colorClass={todayColorClass}>
                {todayTotalRations}
                {todayPlanTotal > 0 ? ` / ${todayPlanTotal}` : ''}
              </WidgetHighlight>
            </span>,
            <span key="yesterday" className="font-medium text-muted-foreground">
              Hier : {yesterdayTotalRations}
              {yesterdayPlanTotal > 0 ? ` / ${yesterdayPlanTotal}` : ''}{' '}
              {yesterdayTotalRations > 1 ? 'rations' : 'ration'}
            </span>,
          ]
        : 'Chargement...',
    [
      device,
      todayColorClass,
      todayTotalRations,
      todayPlanTotal,
      yesterdayTotalRations,
      yesterdayPlanTotal,
    ],
  );

  if (!device && !loading) return null;

  return (
    <BaseWidget
      id="feeder"
      testID="widget-petkit"
      title={config.title}
      subtitle={subtitleNode}
      icon={config.icon}
    >
      {loading ? (
        <div className="flex flex-col items-center px-4 py-8">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : device ? (
        <div className="flex flex-col gap-6 pt-2">
          <WidgetDateNav
            date={selectedDate}
            onPrev={goToPreviousDay}
            onNext={goToNextDay}
            canAccessHistory={!!canAccessHistory}
          />

          {/* Rations summary cards for Today & Yesterday */}
          <div className="grid grid-cols-2 gap-3 px-1">
            <RationsCard title="Aujourd'hui" served={todayTotalRations} planned={todayPlanTotal} />
            <RationsCard title="Hier" served={yesterdayTotalRations} planned={yesterdayPlanTotal} />
          </div>

          <div className="flex flex-col items-stretch gap-6">
            <div className="px-1">
              <Panel className="rounded-2xl">
                <div className="mb-4 flex flex-row items-center gap-2">
                  <Utensils size={14} className="text-warning" />
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Consommation par Bac
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  <BowlRow
                    name="Bac 1"
                    dotClassName="bg-cobalt"
                    foodStatus={device.status?.food1}
                    rations={consumedAmount1}
                  />
                  <div className="h-px w-full bg-border" />
                  <BowlRow
                    name="Bac 2"
                    dotClassName="bg-lime"
                    foodStatus={device.status?.food2}
                    rations={consumedAmount2}
                  />
                </div>
              </Panel>
            </div>

            <FeederControls
              isRefreshing={isRefreshing}
              isFeeding={isFeeding}
              onRefresh={handleRefresh}
              onFeed={handleFeed}
            />
          </div>

          {(canAccessHistory || isToday(selectedDate)) && (
            <FeederTimeline
              recordsForDay={recordsForDay}
              filteredRecords={filteredRecords}
              timelineFilter={timelineFilter}
              onFilterChange={setTimelineFilter}
              movesCount={counts.moves}
              visitsCount={counts.visits}
              eatsCount={counts.eats}
              feedsCount={counts.feeds}
              canAccessHistory={!!canAccessHistory}
              selectedDate={selectedDate}
              getDateLabel={getDateLabel}
            />
          )}
        </div>
      ) : (
        <div className="p-4">
          <p className="text-muted-foreground">Aucun distributeur trouvé</p>
        </div>
      )}
    </BaseWidget>
  );
});
