/**
 * Home Assistant Lights Selection & Logic Hook
 * Specializes in light-specific interactions, master/child syncing, and action debouncing.
 */
import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useHAState } from './useHAState';
import { useSceneConfig } from './useSceneConfig';
import { HAState } from '../services/api';

/**
 * Brightness suggested by a scene name when the scene has no configured brightness.
 *
 * @param sceneName - Scene friendly name.
 * @returns Brightness in percent.
 */
export function guessSceneBrightness(sceneName: string): number {
  const name = sceneName.toLowerCase();
  if (name.includes('veilleuse') || name.includes('nuit')) return 1;
  if (name.includes('détente') || name.includes('relax') || name.includes('soir')) return 50;
  if (name.includes('lecture') || name.includes('concentr')) return 80;
  if (name.includes('lumineux') || name.includes('jour') || name.includes('plein')) return 100;
  return 50; // Default to medium if unknown
}

/**
 * Hook to manage light entity interactions, action queuing, master/child logic, and area grouping.
 *
 * @param options - Hook options including callbacks, static light lists, and metadata.
 * @returns Object with toggle/brightness handlers and light state helpers.
 */
export function useLights(options?: {
  onProcessed?: () => void;
  lights?: HAState[];
  metadata?: Record<string, { area: string; model: string }>;
}) {
  const { performAction, getEffectiveValue, applyOptimisticUpdate } = useHAState();
  const { getSceneBrightness } = useSceneConfig();
  const actionQueueRef = useRef<{ entityId: string; newState?: boolean; brightness?: number }[]>(
    [],
  );
  const queueTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onProcessedRef = useRef(options?.onProcessed);
  useEffect(() => {
    onProcessedRef.current = options?.onProcessed;
  }, [options?.onProcessed]);

  const rawLights = options?.lights;
  const rawMetadata = options?.metadata;

  const lights = useMemo(() => rawLights ?? [], [rawLights]);
  const metadata = useMemo(() => rawMetadata ?? {}, [rawMetadata]);

  const processQueue = useCallback(async () => {
    if (actionQueueRef.current.length === 0) return;

    const batch = [...actionQueueRef.current];
    actionQueueRef.current = [];

    // Group actions by their unique "domain + service + data" signature
    const groups: Record<
      string,
      {
        ids: string[];
        domain: string;
        service: string;
        data: Record<string, unknown>;
        optValue: string;
      }
    > = {};

    batch.forEach((action) => {
      const isTurnOff = action.newState === false || action.brightness === 0;
      const service = isTurnOff ? 'turn_off' : 'turn_on';

      // Only include brightness if it's > 0
      const data =
        action.brightness !== undefined && action.brightness > 0
          ? { brightness: action.brightness }
          : {};
      const optValue =
        action.brightness !== undefined && action.brightness > 0
          ? 'on'
          : action.newState
            ? 'on'
            : 'off';

      const groupKey = `${service}-${JSON.stringify(data)}`;
      if (!groups[groupKey]) {
        groups[groupKey] = { ids: [], domain: 'light', service, data, optValue };
      }
      if (!groups[groupKey].ids.includes(action.entityId)) {
        groups[groupKey].ids.push(action.entityId);
      }
    });

    // Execute each group as a single batch call
    for (const key in groups) {
      const group = groups[key];
      await performAction(
        group.ids.map((id) => ({ entity_id: id }) as HAState),
        group.domain,
        group.service,
        group.data,
        group.optValue,
      );
    }

    // Trigger completion callback
    onProcessedRef.current?.();
  }, [performAction]);

  const queueAction = useCallback(
    (action: { entityId: string; newState?: boolean; brightness?: number; optValue?: string }) => {
      actionQueueRef.current.push(action);
      if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = setTimeout(processQueue, 50);
    },
    [processQueue],
  );

  // ── Low-level functions used by the handlers below ──

  /**
   * Toggles a light's state, optionally applying it to all children of a master.
   *
   * @param entityId - Target light ID.
   * @param currentState - Current state ('on' or 'off').
   * @param isMaster - Whether this light acts as a master for an area.
   * @param childIds - Array of child light IDs to toggle alongside.
   */
  const toggleLight = useCallback(
    (entityId: string, currentState: string, isMaster: boolean, childIds: string[]) => {
      const newState = currentState !== 'on';
      const optValue = newState ? 'on' : 'off';

      queueAction({ entityId, newState, optValue });

      if (isMaster) {
        childIds.forEach((id) => queueAction({ entityId: id, newState, optValue }));
      }
    },
    [queueAction],
  );

  /**
   * Sets brightness for a light, optionally applying it to all children of a master.
   *
   * @param entityId - Target light ID.
   * @param brightness - Brightness value (0-255).
   * @param isMaster - Whether this light acts as a master for an area.
   * @param childIds - Array of child light IDs to update alongside.
   */
  const setBrightness = useCallback(
    (entityId: string, brightness: number, isMaster: boolean, childIds: string[]) => {
      const optValue = brightness > 0 ? 'on' : 'off';

      queueAction({ entityId, brightness, optValue });

      if (isMaster) {
        childIds.forEach((id) => queueAction({ entityId: id, brightness, optValue }));
      }
    },
    [queueAction],
  );

  // ── High-level handlers (encapsulate master/child resolution) ──

  const resolveMaster = useCallback(
    (entityId: string) => {
      const area = metadata[entityId]?.area;
      const model = metadata[entityId]?.model;
      const friendlyName =
        lights
          .find((l: HAState) => l.entity_id === entityId)
          ?.attributes.friendly_name?.toLowerCase() || '';

      const isMaster =
        !!area &&
        (friendlyName === area.toLowerCase() ||
          friendlyName === area.toLowerCase() + ' group' ||
          model === 'Room');

      const childIds = isMaster
        ? lights
            .filter(
              (l: HAState) => metadata[l.entity_id]?.area === area && l.entity_id !== entityId,
            )
            .map((l: HAState) => l.entity_id)
        : [];

      return { isMaster, childIds };
    },
    [lights, metadata],
  );

  const handleToggleLight = useCallback(
    (entityId: string) => {
      const light = lights.find((l: HAState) => l.entity_id === entityId);
      if (!light) return;

      const currentState = getEffectiveValue(light) === 'on' ? 'on' : 'off';
      const { isMaster, childIds } = resolveMaster(entityId);
      toggleLight(entityId, currentState, isMaster, childIds);
    },
    [lights, getEffectiveValue, resolveMaster, toggleLight],
  );

  const handleSetBrightness = useCallback(
    (entityId: string, value: number) => {
      const { isMaster, childIds } = resolveMaster(entityId);
      setBrightness(entityId, value, isMaster, childIds);
    },
    [resolveMaster, setBrightness],
  );

  const handleActivateScene = useCallback(
    async (sceneId: string, sceneName: string, activeRoomLightIds: string[]) => {
      // 1. Prepare optimistic values
      const realBrightness = getSceneBrightness(sceneId);
      const targetBrightnessPct =
        realBrightness !== null
          ? Math.round((realBrightness / 255) * 100)
          : guessSceneBrightness(sceneName);

      const targetBrightness255 =
        realBrightness !== null ? realBrightness : Math.round((targetBrightnessPct / 100) * 255);

      const optimisticUpdates: Record<string, string | number | boolean> = {};
      activeRoomLightIds.forEach((lightId) => {
        optimisticUpdates[lightId] = 'on';
        optimisticUpdates[`${lightId}_attr_brightness`] = targetBrightness255;
      });

      // 2. D'abord, appliquer la mise à jour optimiste dans le cache.
      applyOptimisticUpdate(optimisticUpdates);

      // 3. Ensuite, lancer l'action de la scène.
      performAction({ entity_id: sceneId } as HAState, 'scene', 'turn_on', {}, 'on');
    },
    [performAction, applyOptimisticUpdate, getSceneBrightness],
  );

  // Stable between renders: the lights widget is memoized and must not re-render on each poll.
  const getLightState = useCallback(
    (entity: HAState) => getEffectiveValue(entity) === 'on',
    [getEffectiveValue],
  );
  const getLightBrightness = useCallback(
    (entity: HAState) => Number(getEffectiveValue(entity, 'brightness')) || 0,
    [getEffectiveValue],
  );

  return {
    handleToggleLight,
    handleSetBrightness,
    handleActivateScene,
    getLightState,
    getLightBrightness,
  };
}
