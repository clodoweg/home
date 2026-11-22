/** widget-stub — Lightweight stand-ins for dashboard widgets, so hook tests do not load the real ones. */
import React from 'react';

/** Names of the stubs that throw when rendered (to exercise error boundaries). */
export const crashingWidgets = new Set<string>();

/**
 * Builds a stub widget component.
 *
 * @param name - Name rendered in the stub's test id.
 * @returns A component rendering `<div data-testid="widget-stub-<name>">`.
 */
export const stubWidget = (name: string) => {
  const Stub = (_props: Record<string, unknown>): React.ReactElement => {
    // eslint-disable-next-line sonarjs/no-empty-collection -- filled by the tests through the export
    if (crashingWidgets.has(name)) throw new Error(`${name} exploded`);
    return <div data-testid={`widget-stub-${name}`} />;
  };
  Stub.displayName = `${name}Stub`;
  return Stub;
};
