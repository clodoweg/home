/** tariffs tests — prix de l'électricité (Base) et du gaz (prix repère) selon la date. */
import { describe, expect, it } from 'vitest';
import { electricityPrice, gasPrice } from './tariffs';

describe('tariffs', () => {
  it('applies the Base price in force on the day', () => {
    expect(electricityPrice('2026-11-19')).toBe(0.2001);
    expect(electricityPrice('2026-07-31')).toBe(0.194);
    expect(electricityPrice('2024-06-01')).toBe(0.2516);
    expect(electricityPrice('2020-01-01')).toBe(0.2062);
  });

  it('applies the monthly gas reference price, flagging the approximate months', () => {
    expect(gasPrice('2026-11-19')).toEqual({ price: 0.15761, approximate: false });
    expect(gasPrice('2025-09-10')).toEqual({ price: 0.10337, approximate: true });
    expect(gasPrice('2023-12-01').approximate).toBe(true);
  });
});
