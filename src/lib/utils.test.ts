/** utils tests — conditional Tailwind class merging. */
import { describe, expect, it } from 'vitest';
import { cn } from './utils';

// Held in variables: the Tailwind lint rules would flag the deliberately conflicting literals.
const BASE = 'p-2 text-red-500';
const PADDING_OVERRIDE = 'p-4';
const COLOR_OVERRIDE = 'text-blue-500';

describe('cn', () => {
  it('joins truthy classes and drops falsy ones', () => {
    const [first, second, third, fourth] = ['flex', 'p-2', 'm-1', 'rounded'];
    expect(cn(first, false, null, undefined, second, { [third]: true, x: false }, [fourth])).toBe(
      'flex p-2 m-1 rounded',
    );
  });

  it('lets the last conflicting Tailwind class win', () => {
    expect(cn(BASE, PADDING_OVERRIDE, COLOR_OVERRIDE)).toBe('p-4 text-blue-500');
  });

  it('returns an empty string without classes', () => {
    expect(cn()).toBe('');
  });
});
