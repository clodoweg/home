/** areaIcons tests — icon chosen for a Home Assistant area, custom icons first. */
import {
  Armchair,
  BookOpen,
  Car,
  DoorOpen,
  Lamp,
  Lightbulb,
  Moon,
  Shrub,
  Sun,
  Warehouse,
} from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { getIconForArea, ROOM_ICONS } from './areaIcons';

describe('ROOM_ICONS', () => {
  it('labels every selectable icon', () => {
    expect(Object.keys(ROOM_ICONS)).toHaveLength(24);
    for (const { icon, label } of Object.values(ROOM_ICONS)) {
      expect(icon).toBeTruthy();
      expect(label).not.toBe('');
    }
  });
});

describe('getIconForArea', () => {
  it.each([
    ['Chambre parents', Moon],
    ['Master BEDroom', Moon],
    ['Cuisine', Sun],
    ['Kitchen', Sun],
    ['Salon', Lamp],
    ['Living room', Lamp],
    ['Salle de bain', Lightbulb],
    ['Bathroom', Lightbulb],
    ['Entree', DoorOpen],
    ['Hall', DoorOpen],
    ['Entry', DoorOpen],
    ['Jardin', Shrub],
    ['Garden', Shrub],
    ['Terrasse', Armchair],
    ['Terrace', Armchair],
    ['Patio', Armchair],
    ['Garage', Warehouse],
    ['Parking', Warehouse],
    ['Bibliotheque', BookOpen],
    ['Library', BookOpen],
    ['Grenier', Lightbulb],
  ])('maps "%s" by keyword', (area, expected) => {
    expect(getIconForArea(area)).toBe(expected);
  });

  it('B28: matches accented spellings (Entrée, Bibliothèque)', () => {
    expect(getIconForArea('Entrée')).toBe(DoorOpen);
    expect(getIconForArea('Bibliothèque')).toBe(BookOpen);
  });

  it('applies the first matching keyword', () => {
    expect(getIconForArea('Chambre avec salle de bain')).toBe(Moon);
  });

  it('prefers a known custom icon', () => {
    expect(getIconForArea('Salon', { Salon: 'Car' })).toBe(Car);
  });

  it('falls back to keywords when the custom icon name is unknown', () => {
    expect(getIconForArea('Salon', { Salon: 'Rocket' })).toBe(Lamp);
  });

  it('falls back to keywords when the area has no custom icon', () => {
    expect(getIconForArea('Cuisine', { Salon: 'Car' })).toBe(Sun);
  });
});
