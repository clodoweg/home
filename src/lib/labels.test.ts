import { describe, expect, it } from 'vitest';

import { alarmStatusLabel, translateCondition } from './labels';

describe('translateCondition', () => {
  it('translates a known condition', () => {
    expect(translateCondition('partlycloudy')).toBe('Éclaircies');
  });

  it('falls back to the raw condition, without its dash', () => {
    expect(translateCondition('very-odd')).toBe('very odd');
  });

  it('names a missing condition', () => {
    expect(translateCondition('')).toBe('Inconnu');
  });
});

describe('alarmStatusLabel', () => {
  it('translates a known state', () => {
    expect(alarmStatusLabel('armed_night')).toBe('Mode nuit');
    expect(alarmStatusLabel('disarmed')).toBe('Désactivée');
  });

  it('keeps an unknown state as is', () => {
    expect(alarmStatusLabel('custom_bypass')).toBe('custom_bypass');
  });
});
