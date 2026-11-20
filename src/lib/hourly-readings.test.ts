/** hourlyReadings tests — one value per hour, held between changes, gaps and bad states. */
import { describe, expect, it } from 'vitest';

import { hourlyReadings } from './hourly-readings';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const at = (hoursAgo: number, state: string) => ({
  state,
  last_changed: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
});

describe('hourlyReadings', () => {
  it('gives 25 points over 24 h, holding each value until it changes', () => {
    const values = hourlyReadings([at(30, '18'), at(10.5, '20'), at(0.2, '21')], NOW);
    expect(values).toHaveLength(25);
    // 24 h ago up to 11 h ago: 18; from 10 h ago: 20; now: 21.
    expect(values.slice(0, 14)).toEqual(Array(14).fill(18));
    expect(values.slice(14, 24)).toEqual(Array(10).fill(20));
    expect(values[24]).toBe(21);
  });

  it('turns a sensor reporting every few minutes into hourly points', () => {
    const dense = Array.from({ length: 24 * 12 + 1 }, (_, i) => at(24 - i / 12, String(i)));
    const values = hourlyReadings(dense, NOW);
    expect(values).toHaveLength(25);
    expect(values[0]).toBe(0);
    expect(values[1]).toBe(12);
    expect(values[24]).toBe(24 * 12);
  });

  it('leaves out the hours before the first reading', () => {
    expect(hourlyReadings([at(2.5, '19'), at(1, '20')], NOW)).toEqual([19, 20, 20]);
  });

  it('skips unavailable states and bad dates', () => {
    const points = [at(3, '19'), at(2, 'unavailable'), { state: '30', last_changed: 'never' }];
    expect(hourlyReadings(points, NOW, 3)).toEqual([19, 19, 19, 19]);
  });

  it('ends on a reading stamped just after now', () => {
    expect(hourlyReadings([at(1, '19'), at(-0.01, '22')], NOW, 1)).toEqual([19, 22]);
  });

  it('is empty without any numeric reading', () => {
    expect(hourlyReadings(undefined, NOW)).toEqual([]);
    expect(hourlyReadings([at(1, 'unknown')], NOW)).toEqual([]);
  });
});
