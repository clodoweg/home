/** floors tests — floor order (user, natural, alphabetical), room order and grouping. */
import { describe, expect, it } from 'vitest';
import {
  compareByUserOrder,
  compareFloors,
  floorPriority,
  groupByFloor,
  isOutdoorFloor,
} from './floors';

describe('floorPriority', () => {
  it('ranks known floors, then unknown names, then no floor', () => {
    expect(floorPriority('Cave')).toBe(1);
    expect(floorPriority('Rez-de-chaussée')).toBeLessThan(floorPriority('1er étage'));
    expect(floorPriority('Grenier')).toBe(900);
    expect(floorPriority(undefined)).toBe(999);
  });
});

describe('compareByUserOrder', () => {
  it('puts saved names first, in their order', () => {
    expect(compareByUserOrder('b', 'a', ['b', 'a'])).toBeLessThan(0);
    expect(compareByUserOrder('a', 'x', ['a'])).toBe(-1);
    expect(compareByUserOrder('x', 'a', ['a'])).toBe(1);
    expect(compareByUserOrder('x', 'y', ['a'])).toBeNull();
  });
});

describe('compareFloors', () => {
  it('uses the user order, then the natural order, then the alphabet', () => {
    const sorted = ['Extérieur', 'Grenier', 'Cave', undefined, 'Atelier', 'RdC'].sort((a, b) =>
      compareFloors(a, b, ['RdC']),
    );
    expect(sorted).toEqual(['RdC', 'Cave', 'Extérieur', 'Atelier', 'Grenier', undefined]);
  });

  it('treats a missing floor as "Autres"', () => {
    expect(compareFloors(undefined, 'Autres', [])).toBe(0);
  });
});

describe('groupByFloor', () => {
  it('keeps the order of first appearance', () => {
    expect(groupByFloor([{ floor: 'RdC', id: 1 }, { id: 2 }, { floor: 'RdC', id: 3 }])).toEqual([
      {
        floor: 'RdC',
        items: [
          { floor: 'RdC', id: 1 },
          { floor: 'RdC', id: 3 },
        ],
      },
      { floor: 'Autres', items: [{ id: 2 }] },
    ]);
  });
});

describe('isOutdoorFloor', () => {
  it.each([
    ['Extérieur', true],
    ['exterieur nord', true],
    ['Étage', false],
    [undefined, false],
  ])('%s → %s', (floor, outdoor) => {
    expect(isOutdoorFloor(floor)).toBe(outdoor);
  });
});
