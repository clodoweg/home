/** format tests — short durations in minutes and hours. */
import { describe, expect, it } from 'vitest';
import { formatMinutes } from './format';

describe('formatMinutes', () => {
  it.each([
    [-5, '0 min'],
    [0, '0 min'],
    [45, '45 min'],
    [120, '2h'],
    [188, '3h 08m'],
  ])('%i → %s', (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });
});
