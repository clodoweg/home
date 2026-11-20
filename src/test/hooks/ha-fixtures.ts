/** ha-fixtures — Builders for Home Assistant entities used by hook tests. */
import type { HAState } from '../../services/client';

/**
 * Builds a Home Assistant entity with neutral timestamps.
 *
 * @param entityId - Entity id, e.g. `light.salon`.
 * @param state - Raw HA state string.
 * @param attributes - Entity attributes.
 * @returns A complete HAState.
 */
export function makeHAState(
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HAState {
  return {
    entity_id: entityId,
    state,
    attributes,
    last_changed: '2026-10-23T08:00:00Z',
    last_updated: '2026-10-23T08:00:00Z',
    context: {},
  };
}
