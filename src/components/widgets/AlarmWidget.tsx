/**
 * AlarmWidget — Alarm control panel with arm/disarm/night/trigger and 24h timeline.
 */
import { alarmStatusLabel } from '../../lib/labels';
import React, { memo, useMemo } from 'react';
import { Bell, Lock, Shield, Unlock } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { BaseWidget, WidgetHighlight } from './BaseWidget';
import { HAState } from '../../services/api';
import { useAlarmHistory } from '../../hooks/useAlarmHistory';
import { useHAState } from '../../hooks/useHAState';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { useNow } from '../../hooks/useNow';
import { cn } from '../../lib/utils';
import { TimelineChart } from '../ui/TimelineChart';
import { Panel } from '../ui/Panel';
import { useElementWidth } from '../../hooks/useElementWidth';

const RED = '#ef4444';
const GREEN = '#22c55e';
const BLUE = '#3b82f6';

/**
 * Alarm panel: arming modes, siren and 24 h history.
 *
 * @param props - Alarm entity, siren and history right.
 * @returns The widget.
 */
export const AlarmWidget = memo(function AlarmWidget({
  entity,
  showHistory = true,
  siren,
}: {
  entity: HAState;
  showHistory?: boolean;
  siren?: HAState;
}) {
  const { loading: actionLoading, getEffectiveValue, performAction } = useHAState();
  // Moves every minute: the 23 h / 30 day windows must not freeze while the PWA stays open.
  const now = useNow();

  const historyQuery = useAlarmHistory(entity.entity_id, showHistory);

  const history = historyQuery.data || [];

  const stableSince = useMemo(() => {
    if (!historyQuery.data) return null;
    const stepData = historyQuery.data;

    let currentS = 0;
    if (entity.state === 'triggered') currentS = 3;
    else if (entity.state === 'armed_night' || entity.state === 'armed_home') currentS = 2;
    else if (entity.state === 'armed_away') currentS = 1;
    else if (entity.state === 'unavailable' || entity.state === 'unknown') currentS = -1;

    let calculatedStart = entity.last_changed ? new Date(entity.last_changed).getTime() : now;

    if (stepData.length > 0 && currentS !== -1) {
      let potentialStart = calculatedStart;
      let foundMismatch = false;

      for (let i = stepData.length - 1; i >= 0; i--) {
        if (stepData[i].state === -1) continue;
        if (stepData[i].state === currentS) {
          potentialStart = stepData[i].timestamp;
        } else {
          foundMismatch = true;
          break;
        }
      }

      const isOldEnough = stepData[0]?.timestamp <= now - 23 * 60 * 60 * 1000;
      if (!foundMismatch && isOldEnough) return -1;

      if (potentialStart < calculatedStart) calculatedStart = potentialStart;
    }
    return calculatedStart;
  }, [historyQuery.data, entity.state, entity.last_changed, now]);

  const lastSecurityEvent = useMemo(() => {
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Siren: only consider if siren state is currently 'on'
    const sirenTs =
      siren?.state === 'on' && siren?.last_changed ? new Date(siren.last_changed).getTime() : null;

    const candidates: { ts: number; label: string }[] = [];
    if (sirenTs && sirenTs > thirtyDaysAgo) candidates.push({ ts: sirenTs, label: 'Sirène' });

    if (candidates.length === 0) return null;
    const best = candidates.reduce((a, c) => (c.ts > a.ts ? c : a), candidates[0]);
    return { ...best, isToday: best.ts >= todayStart.getTime() };
  }, [siren, now]);

  const getFormattedDate = (ts: number | string) => {
    const date = new Date(ts);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAction = (action: string) => {
    let targetState = 'disarmed';
    let service = 'alarm_disarm';
    if (action === 'arm_away') {
      targetState = 'armed_away';
      service = 'alarm_arm_away';
    }
    if (action === 'arm_night') {
      targetState = 'armed_night';
      service = 'alarm_arm_night';
    }
    if (action === 'trigger') {
      targetState = 'triggered';
      service = 'alarm_trigger';
    }
    performAction(entity, 'alarm_control_panel', service, {}, targetState);
  };

  const state = (getEffectiveValue(entity) as string) || entity.state;

  const buttons = [
    {
      id: 'arm_away',
      icon: Lock,
      isActive: state === 'armed_away',
      action: () => handleAction('arm_away'),
    },
    {
      id: 'disarm',
      icon: Unlock,
      isActive: state === 'disarmed',
      action: () => handleAction('disarm'),
    },
    {
      id: 'arm_night',
      icon: Shield,
      isActive: state === 'armed_night' || state === 'armed_home',
      action: () => handleAction('arm_night'),
    },
    {
      id: 'trigger',
      icon: Bell,
      isActive: state === 'triggered',
      action: () => handleAction('trigger'),
    },
  ];

  const [chartContainerRef, chartWidth] = useElementWidth();

  const statusColorClass =
    state === 'triggered'
      ? 'text-destructive'
      : state === 'disarmed'
        ? 'text-success'
        : 'text-info';

  return (
    <BaseWidget
      id="alarm"
      title={WIDGET_CONFIG.alarm.title}
      subtitle={[
        <WidgetHighlight key="1" colorClass={statusColorClass}>
          {alarmStatusLabel(state)}
        </WidgetHighlight>,
        showHistory
          ? stableSince === -1
            ? '> 24h'
            : `depuis ${getFormattedDate(stableSince ? stableSince : entity.last_changed || now)}`
          : null,
        state !== 'triggered' && lastSecurityEvent ? (
          <WidgetHighlight
            key="event"
            colorClass={lastSecurityEvent.isToday ? 'text-destructive' : 'text-muted-foreground'}
          >
            {`${lastSecurityEvent.label} le ${getFormattedDate(lastSecurityEvent.ts)}`}
          </WidgetHighlight>
        ) : null,
      ].filter(Boolean)}
      icon={WIDGET_CONFIG.alarm.icon}
      muted={state === 'disarmed'}
    >
      <div className="flex flex-row items-center justify-around py-4">
        {buttons.map((btn) => {
          const isActionLoading = actionLoading === entity.entity_id && btn.isActive;
          const isActive = btn.isActive;
          const Icon = btn.icon;

          return (
            <button
              type="button"
              key={btn.id}
              data-testid={`alarm-btn-${btn.id}`}
              onClick={btn.action}
              disabled={actionLoading !== null}
              className={cn(
                'flex size-16 items-center justify-center rounded-full transition-all',
                isActive ? 'bg-coral' : 'bg-muted',
                actionLoading !== null && !isActionLoading && 'opacity-50',
              )}
            >
              {isActionLoading ? (
                <Skeleton className="size-8 rounded-full" />
              ) : (
                <Icon
                  size={32}
                  className={isActive ? 'text-ink' : 'text-foreground'}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              )}
            </button>
          );
        })}
      </div>

      {showHistory && (
        <Panel className="mt-3">
          <div ref={chartContainerRef}>
            <TimelineChart
              data={history}
              width={chartWidth || 300}
              hours={24}
              getColor={(s, isToday) => {
                if (s === 3) return RED;
                if (s === 2) return BLUE;
                if (s === 1) return BLUE;
                if (s === 0) return isToday ? GREEN : '#22543d';
                return '#6b7280';
              }}
            />
          </div>
        </Panel>
      )}
    </BaseWidget>
  );
});
