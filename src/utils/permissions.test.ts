/** permissions tests — the UI grants exactly the rights the back grants (lib/permissions.ts). */
import { describe, expect, it } from 'vitest';
import { hasPermission } from './permissions';

describe('hasPermission', () => {
  it.each([
    ['history', { group: 'user', permissions: ['history'] }],
    ['cameras', { group: 'children', permissions: ['cameras'] }],
    ['history', { group: 'admin', permissions: [] }],
    ['cameras', { group: 'admin' }],
  ] as const)('grants %s for %j', (flag, profile) => {
    expect(hasPermission(profile, flag)).toBe(true);
  });

  it.each([
    ['history', { group: 'user', permissions: [] }],
    ['cameras', { group: 'user', permissions: ['remote', 'history'] }],
    ['history', { group: 'children', permissions: [] }],
    ['cameras', { group: 'user' }],
    ['history', null],
    ['cameras', undefined],
  ] as const)('refuses %s for %j', (flag, profile) => {
    expect(hasPermission(profile, flag)).toBe(false);
  });
});
