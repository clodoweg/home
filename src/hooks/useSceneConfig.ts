/**
 * useSceneConfig — Fetches and caches HA scene configurations.
 * Exposes a helper to resolve the target brightness defined for a scene,
 * used by useLights to apply accurate optimistic updates on scene activation.
 */
import { useCallback, useMemo } from 'react';
import { getScenes, SceneConfig } from '../services/api';
import { createTokenQuery } from './createTokenQuery';
import { queryKeys } from '../lib/query-keys';

const useScenesQuery = createTokenQuery<SceneConfig>(queryKeys.ha.scenes, getScenes, {
  staleTime: 1000 * 60 * 5,
});

/**
 * Hook to fetch and manage scene configurations.
 * Provides a helper to get target brightness for a specific scene.
 */
export function useSceneConfig() {
  const { data, isLoading } = useScenesQuery();
  const scenes: SceneConfig = useMemo(() => data ?? {}, [data]);

  /**
   * Helper to get the target brightness (0-255) defined in a scene.
   * Returns null if not found or not defined.
   */
  const getSceneBrightness = useCallback(
    (sceneId: string): number | null => {
      return scenes[sceneId]?.brightness ?? null;
    },
    [scenes],
  );

  return {
    scenes,
    isLoading,
    getSceneBrightness,
  };
}
