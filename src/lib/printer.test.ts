import { afterEach, describe, expect, it, vi } from 'vitest';

import { calculateRemainingMinutes, formatPrintStatus } from './printer';

describe('formatPrintStatus', () => {
  it.each([
    ['printing', 'En cours'],
    ['Running ', 'En cours'],
    ['prepare', 'En cours'],
    ['preparing', 'En cours'],
    ['paused', 'En pause'],
    ['pause', 'En pause'],
    ['finish', 'Terminé'],
    ['finished', 'Terminé'],
    ['success', 'Terminé'],
    ['idle', 'En attente'],
    ['standby', 'En attente'],
    ['ready', 'En attente'],
    ['offline', 'Hors ligne'],
    ['unavailable', 'Hors ligne'],
    ['calibrating', 'calibrating'],
  ])('words %s as %s', (status, label) => {
    expect(formatPrintStatus(status).label).toBe(label);
  });

  it('names a missing status', () => {
    expect(formatPrintStatus(undefined).label).toBe('Inconnu');
  });
});

describe('calculateRemainingMinutes', () => {
  afterEach(() => vi.useRealTimers());

  it('is zero once the printer is not printing', () => {
    expect(calculateRemainingMinutes(undefined, '42', 'min', 'Finished')).toBe(0);
  });

  it('reads hh:mm:ss and hh:mm', () => {
    expect(calculateRemainingMinutes(undefined, '1:30:40', undefined, 'printing')).toBe(91);
    expect(calculateRemainingMinutes(undefined, '2:05', undefined, 'printing')).toBe(125);
  });

  it('reads « 1h 20 », « 3 heures » and « 2 hrs »', () => {
    expect(calculateRemainingMinutes(undefined, '1h 20', undefined, 'printing')).toBe(80);
    expect(calculateRemainingMinutes(undefined, '3 heures', undefined, 'printing')).toBe(180);
    expect(calculateRemainingMinutes(undefined, '2 hrs', undefined, 'printing')).toBe(120);
  });

  it('reads a number in minutes, or in hours when the unit says so', () => {
    expect(calculateRemainingMinutes(undefined, '15', 'min', 'printing')).toBe(15);
    expect(calculateRemainingMinutes(undefined, '1.5', 'h', 'printing')).toBe(90);
    expect(calculateRemainingMinutes(undefined, '2', 'heures', 'printing')).toBe(120);
  });

  it('falls back on the end time, when it is in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
    expect(
      calculateRemainingMinutes('2026-11-14T10:45:00Z', 'unknown', undefined, 'printing'),
    ).toBe(45);
    expect(
      calculateRemainingMinutes('2026-11-14T09:00:00Z', undefined, undefined, 'printing'),
    ).toBe(0);
    expect(calculateRemainingMinutes('unavailable', undefined, undefined, 'printing')).toBe(0);
    expect(calculateRemainingMinutes('pas une date', 'abc', undefined, 'printing')).toBe(0);
  });
});
