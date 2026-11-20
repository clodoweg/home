/**
 * ArloWidget — Camera grid with on-demand snapshot refresh.
 */
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Camera, RefreshCw, WifiOff, Zap } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { BaseWidget, WidgetHighlight } from './BaseWidget';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { HAState, triggerArloSnapshot } from '../../services/api';
import { cameraImageUrl, listArloCameras, type ArloCamera } from '../../lib/arlo';
import { useUserProfile } from '../../context/UserContext';
import { Button } from '../ui/Button';
import { SecureImage } from '../ui/SecureImage';
import { Panel } from '../ui/Panel';
import { logger } from '../../lib/logger';
import { cn } from '../../lib/utils';
import { useWidgetPreferences } from '../../context/WidgetPreferencesContext';

interface ArloWidgetProps {
  entities: HAState[];
  onRefresh?: () => void;
  refreshTrigger?: number;
}

/**
 * Formats a relative date/time for French locale (e.g., "Aujourd'hui à 19:46", "Hier à 19:05").
 */
const formatRelativeDateTime = (date: Date): string => {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Aujourd'hui à ${timeStr}`;
  if (isYesterday) return `Hier à ${timeStr}`;

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Extracts and formats the real camera capture date from various Home Assistant sources.
 * Arlo camera entities store capture dates in image_source ("snapshot/10-07 19:46"),
 * thumbnail URLs (timestamp in ms), or sensor.aarlo_last_* state, whereas last_changed
 * only reflects when the entity state string itself (e.g. "recording") changed.
 */
const formatCaptureDate = (
  imageSource: string | undefined,
  thumbnailUrl: string | undefined,
  lastSensorState: string | undefined,
  lastUpdated: string | undefined,
  lastChanged: string | undefined,
): string => {
  // 1. Try parsing 13-digit epoch timestamp from thumbnail URL (e.g. recordings/1791392584171_thumb.jpg)
  if (thumbnailUrl) {
    const match = thumbnailUrl.match(/(\d{13})/);
    if (match) {
      const date = new Date(parseInt(match[1], 10));
      if (!isNaN(date.getTime())) {
        return formatRelativeDateTime(date);
      }
    }
  }

  // 2. Try parsing image_source (e.g. "snapshot/10-07 19:46" or "capture/10-06 19:05")
  if (imageSource) {
    const match = imageSource.match(/(?:snapshot|capture)\/(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, month, day, hour, minute] = match;
      const now = new Date();
      const date = new Date(
        now.getFullYear(),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
      );
      if (!isNaN(date.getTime())) {
        return formatRelativeDateTime(date);
      }
      return `${day}/${month} à ${hour}:${minute}`;
    }
  }

  // 3. Try parsing last capture sensor state (e.g. "10-07 19:03")
  if (lastSensorState && lastSensorState !== 'unknown' && lastSensorState !== 'unavailable') {
    const match = lastSensorState.match(/(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, month, day, hour, minute] = match;
      const now = new Date();
      const date = new Date(
        now.getFullYear(),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
      );
      if (!isNaN(date.getTime())) {
        return formatRelativeDateTime(date);
      }
      return `${day}/${month} à ${hour}:${minute}`;
    }
  }

  // 4. Fall back to last_updated or last_changed ISO date
  const isoDate = lastUpdated || lastChanged;
  if (!isoDate) return 'Inconnue';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return 'Inconnue';
    return formatRelativeDateTime(date);
  } catch {
    return 'Inconnue';
  }
};

/**
 * Arlo cameras widget: latest snapshots and snapshot requests.
 *
 * @param props - Camera entities and refresh trigger.
 * @returns The widget.
 */
export const ArloWidget = memo(function ArloWidget({
  entities,
  onRefresh,
  refreshTrigger,
}: ArloWidgetProps) {
  const { token } = useUserProfile();
  const [takingSnapshot, setTakingSnapshot] = useState<string | null>(null);
  const [takingAllSnapshots, setTakingAllSnapshots] = useState(false);
  const lastAutoSnapshotTimeRef = React.useRef<number>(0);
  const SNAPSHOT_THROTTLE_MS = 30000;

  const cameras = useMemo(() => listArloCameras(entities), [entities]);

  const triggerAllSnapshots = React.useCallback(async () => {
    const now = Date.now();
    if (now - lastAutoSnapshotTimeRef.current < SNAPSHOT_THROTTLE_MS) {
      logger.info('[ArloWidget] Snapshot throttled');
      return;
    }
    if (!token || cameras.length === 0) return;

    logger.info('[ArloWidget] Triggering auto-snapshots for all cameras');
    lastAutoSnapshotTimeRef.current = now;
    setTakingAllSnapshots(true);

    // One camera offline (the back answers 502) must not prevent refreshing the others.
    const results = await Promise.allSettled(
      cameras
        .filter((cam) => cam.cameraEntity)
        .map((cam) => triggerArloSnapshot(token, cam.cameraEntity!.entity_id)),
    );
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error('[ArloWidget] Some snapshots failed', failures);
    }
    if (failures.length === results.length) {
      setTakingAllSnapshots(false);
      return;
    }
    setTimeout(() => {
      onRefresh?.();
      setTakingAllSnapshots(false);
    }, 3000);
  }, [token, cameras, onRefresh]);

  // Automatic snapshots on open and on every dashboard refresh (refreshTrigger), never on a
  // states poll: `triggerAllSnapshots` changes with each poll (new `cameras`), so it is read
  // through a ref instead of being an effect dependency.
  const triggerAllSnapshotsRef = React.useRef(triggerAllSnapshots);
  useEffect(() => {
    triggerAllSnapshotsRef.current = triggerAllSnapshots;
  });
  // Booleans, not the token itself: a token refresh must not take new snapshots. The pictures
  // only show in the widget body: no snapshot while it is collapsed, one when it opens.
  const expanded = !useWidgetPreferences().isCollapsed('arlo');
  const canSnapshot = cameras.length > 0 && Boolean(token) && expanded;
  useEffect(() => {
    if (canSnapshot) triggerAllSnapshotsRef.current();
  }, [refreshTrigger, canSnapshot]);

  const handleTakeSnapshot = async (cam: ArloCamera) => {
    if (!cam.cameraEntity || !token) return;

    setTakingSnapshot(cam.id);
    try {
      const success = await triggerArloSnapshot(token, cam.cameraEntity.entity_id);
      if (success) {
        setTimeout(() => onRefresh?.(), 2500);
        setTimeout(() => onRefresh?.(), 5500);
      }
    } catch (e) {
      logger.error('Failed to take snapshot', e);
    } finally {
      setTimeout(() => setTakingSnapshot(null), 2500);
    }
  };

  return (
    <BaseWidget
      id="arlo"
      title={WIDGET_CONFIG.arlo.title}
      subtitle={[
        <span key="1">
          <WidgetHighlight colorClass="text-info">{cameras.length}</WidgetHighlight> caméras
        </span>,
      ]}
      icon={WIDGET_CONFIG.arlo.icon}
    >
      {/* Cameras side by side once the widget is wide (two section columns on a computer). */}
      <div className="@container">
        <div
          className={cn(
            'grid grid-cols-1 items-start gap-4',
            cameras.length > 1 && '@3xl:grid-cols-2',
          )}
        >
          {cameras.map((cam) => {
            const isMotion = cam.motionEntity?.state === 'on';
            const isOffline = cam.connectedEntity?.state === 'off';
            const isLoadingSnapshot = takingSnapshot === cam.id || takingAllSnapshots;
            const imageUrl = cameraImageUrl(cam);

            const captureDateText = formatCaptureDate(
              cam.cameraEntity?.attributes?.image_source,
              cam.cameraEntity?.attributes?.last_thumbnail,
              cam.lastCaptureEntity?.state,
              cam.cameraEntity?.last_updated,
              cam.cameraEntity?.last_changed,
            );

            return (
              <Panel key={cam.id} className="overflow-hidden p-0">
                <div className="flex flex-row items-center justify-between bg-muted p-3">
                  <span className="flex-1 font-semibold text-foreground">{cam.name}</span>
                  <div className="flex flex-row items-center gap-2">
                    {isOffline && (
                      <div className="flex flex-row items-center gap-1 rounded-sm bg-secondary px-2 py-1">
                        <WifiOff size={10} className="text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground">
                          HORS LIGNE
                        </span>
                      </div>
                    )}
                    {isMotion && (
                      <div className="flex flex-row items-center gap-1 rounded-sm bg-destructive/10 px-2 py-1">
                        <Zap size={10} className="text-destructive" />
                        <span className="text-[10px] font-bold text-destructive">MOUVEMENT</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative flex aspect-video items-center justify-center bg-black/50">
                  {isLoadingSnapshot ? (
                    <div className="flex flex-col items-center gap-2">
                      <Skeleton className="size-4 rounded-full" />
                      <span className="text-xs text-muted-foreground">Capture en cours...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-50">
                      <Camera size={32} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Pas d'image</span>
                    </div>
                  )}
                  {/* Authenticated image over the placeholder; the previous picture stays until the next one is loaded. */}
                  <SecureImage
                    src={imageUrl}
                    keepPrevious
                    alt={cam.name}
                    className="absolute inset-0"
                  />
                  {isLoadingSnapshot && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Skeleton className="size-4 rounded-full" />
                    </div>
                  )}
                </div>

                <div className="flex flex-row items-center justify-between p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Dernière capture</p>
                    <p className="text-sm font-medium text-foreground">{captureDateText}</p>
                  </div>

                  <Button
                    data-testid={`arlo-refresh-${cam.id}`}
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                    icon={RefreshCw}
                    onClick={() => handleTakeSnapshot(cam)}
                    disabled={isLoadingSnapshot}
                    loading={isLoadingSnapshot}
                  />
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </BaseWidget>
  );
});
