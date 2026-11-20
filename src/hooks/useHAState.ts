/**
 * Home Assistant State Mutation Hook
 * Manages entity state changes with optimistic UI updates and automated rollbacks via React Query.
 *
 * WARNING: Business logic for critical infrastructure (alarms, locks, gates).
 * Ensure optimistic updates do not hide failures for critical security entities.
 */
import { useCallback } from 'react';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { executeAction, HAState } from '../services/api';
import { useUserProfile } from '../context/UserContext';
import { groupHAStates, type HAData } from '../lib/ha-groups';
import { logger } from '../lib/logger';
import { queryKeys } from '../lib/query-keys';
import { notifyActionFailure } from '../lib/action-feedback';

/** Shared by every useHAState instance: lets each one see the actions of the others. */
const HA_ACTION_KEY = ['ha', 'action'] as const;

/** Home Assistant needs a moment before a change shows up in its states. */
const SETTLE_REFETCH_DELAY_MS = 2_000;

interface HAActionVariables {
  domain: string;
  service: string;
  entityIds: string[];
  data?: Record<string, unknown>;
  /** State shown while the action is in flight (e.g. 'on'). */
  optimisticValue?: string | number;
}

/** State of an entity as a string, or one of its attributes (to be checked by the caller). */
type EffectiveValueReader = {
  (entity: HAState | undefined): string | null;
  (entity: HAState | undefined, attribute: string): unknown;
};

/**
 * useHAState Hook — Refactored with React Query Mutations.
 * Provides methods to execute Home Assistant actions and read optimistic state.
 *
 * @returns Object containing loading status, getEffectiveValue, and performAction methods.
 */
export function useHAState() {
  const { token } = useUserProfile();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: HA_ACTION_KEY,
    mutationFn: async ({ domain, service, entityIds, data }: HAActionVariables) => {
      if (!token) throw new Error('No token');
      const idArg = entityIds.length === 1 ? entityIds[0] : entityIds;
      // Throws on HTTP and network errors (after its 401 retry): onError rolls back.
      return executeAction(token, domain, service, idArg, data);
    },
    onMutate: async ({ entityIds, optimisticValue, data }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.ha.states });

      const currentData = queryClient.getQueryData<HAData>(queryKeys.ha.states);
      const previousData = currentData ? structuredClone(currentData) : undefined;
      // Only the entities of this action: a rollback must not undo another pending action.
      const previousEntities = previousData?.all.filter((e) => entityIds.includes(e.entity_id));

      if (previousData && (optimisticValue !== undefined || data)) {
        queryClient.setQueryData<HAData>(queryKeys.ha.states, (old) => {
          if (!old) return old;
          const newAll = old.all.map((entity) => {
            if (!entityIds.includes(entity.entity_id)) return entity;
            return {
              ...entity,
              state: optimisticValue !== undefined ? String(optimisticValue) : entity.state,
              attributes: data ? { ...entity.attributes, ...data } : entity.attributes,
            };
          });
          return { ...groupHAStates(newAll), metadata: old.metadata };
        });
      }

      return { previousEntities };
    },
    onError: (error, _vars, context) => {
      notifyActionFailure(error);
      const previousEntities = context?.previousEntities;
      if (!previousEntities?.length) {
        logger.warn('No previous data to rollback to');
        return;
      }
      logger.warn(
        'Rolling back entities',
        previousEntities.map((e) => e.entity_id),
      );
      const previousById = new Map(previousEntities.map((e) => [e.entity_id, e]));
      queryClient.setQueryData<HAData>(queryKeys.ha.states, (old) => {
        if (!old) return old;
        const newAll = old.all.map((entity) => previousById.get(entity.entity_id) ?? entity);
        return { ...groupHAStates(newAll), metadata: old.metadata };
      });
    },
    onSettled: () => {
      // Refetch once Home Assistant had time to apply the change, and only when no other
      // action is still in flight (its optimistic state would be overwritten).
      setTimeout(() => {
        if (queryClient.isMutating({ mutationKey: HA_ACTION_KEY }) > 0) return;
        queryClient.invalidateQueries({ queryKey: queryKeys.ha.states });
      }, SETTLE_REFETCH_DELAY_MS);
    },
  });

  /**
   * Executes a Home Assistant service call with optimistic UI updates.
   *
   * @param entity - Target HA entity or array of entities.
   * @param domain - HA domain (e.g., 'light').
   * @param service - HA service (e.g., 'turn_on').
   * @param data - Optional service data.
   * @param optimisticValue - Optional value to show in UI while request is in flight.
   */
  const { mutate } = mutation;
  const performAction = useCallback(
    async (
      entity: HAState | HAState[] | undefined,
      domain: string,
      service: string,
      data?: Record<string, unknown>,
      optimisticValue?: string | number,
    ) => {
      if (!entity) return;
      const entities = Array.isArray(entity) ? entity : [entity];
      const entityIds = entities.map((e) => e.entity_id);

      mutate({
        domain,
        service,
        entityIds,
        data,
        optimisticValue,
      });
    },
    // `mutate` is stable, unlike the mutation result object (new at each render): the light
    // actions built on this callback must not change on every poll.
    [mutate],
  );

  // Every pending action (from any useHAState instance), most recent last.
  const pendingActions = useMutationState({
    filters: { mutationKey: HA_ACTION_KEY, status: 'pending' },
    select: (pending) => pending.state.variables as HAActionVariables,
  });

  /**
   * Retrieves the current effective value of an entity, including pending optimistic updates.
   * Reads the variables of every pending action, so it is reactive and the latest action wins.
   *
   * @param entity - The source HA entity state.
   * @param attribute - Optional attribute name to retrieve.
   * @returns The current state or attribute value.
   */
  const getEffectiveValue = useCallback(
    (entity: HAState | undefined, attribute?: string): unknown => {
      if (!entity) return null;

      for (let i = pendingActions.length - 1; i >= 0; i--) {
        const vars = pendingActions[i];
        if (!vars?.entityIds.includes(entity.entity_id)) continue;
        if (!attribute && vars.optimisticValue !== undefined) {
          return String(vars.optimisticValue);
        }
        if (attribute && vars.data?.[attribute] !== undefined) {
          return vars.data[attribute];
        }
      }

      // Fallback: read from the React Query cache (includes rolled-back / settled state)
      const cachedData = queryClient.getQueryData<HAData>(queryKeys.ha.states);
      const cachedEntity = cachedData?.all.find((e) => e.entity_id === entity.entity_id);
      const source = cachedEntity || entity;

      if (attribute) {
        return source.attributes[attribute];
      }
      return source.state;
    },
    [queryClient, pendingActions],
  ) as EffectiveValueReader;

  const applyOptimisticUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      // Apply raw optimistic update to the cached HA data
      queryClient.setQueryData<HAData>(queryKeys.ha.states, (old) => {
        if (!old) return old;
        const newAll = old.all.map((entity) => {
          const optState = updates[entity.entity_id];
          if (optState === undefined) return entity;
          const attrUpdates: Record<string, unknown> = {};
          for (const key of Object.keys(updates)) {
            if (key.startsWith(`${entity.entity_id}_attr_`)) {
              const attrName = key.replace(`${entity.entity_id}_attr_`, '');
              attrUpdates[attrName] = updates[key];
            }
          }
          return {
            ...entity,
            state: String(optState),
            attributes: { ...entity.attributes, ...attrUpdates },
          };
        });
        return { ...groupHAStates(newAll), metadata: old.metadata };
      });
    },
    [queryClient],
  );

  return {
    // This widget's own latest action only: another widget's action must not disable its buttons.
    loading: mutation.isPending ? (mutation.variables?.entityIds[0] ?? null) : null,
    getEffectiveValue,
    performAction,
    applyOptimisticUpdate,
  };
}
