import { describe, expect, it } from 'vitest';

import {
  SECTIONS,
  parseSectionHash,
  sectionOfWidget,
  widgetDetailHref,
  widgetHref,
} from './sections';
import { WIDGET_CONFIG } from './widgets';

describe('sections', () => {
  it('shows every widget in exactly one section', () => {
    const placed = SECTIONS.flatMap((section) => section.widgets);
    expect([...placed].sort()).toEqual(Object.keys(WIDGET_CONFIG).sort());
  });

  it('finds the section of a widget, home for an unknown one', () => {
    expect(sectionOfWidget('gas')).toBe('energie');
    expect(sectionOfWidget('nope')).toBe('accueil');
  });

  it('reads the section from the hash, home by default', () => {
    expect(parseSectionHash('#maison')).toEqual({ section: 'maison', focus: [] });
    expect(parseSectionHash('energie')).toEqual({ section: 'energie', focus: [] });
    expect(parseSectionHash('')).toEqual({ section: 'accueil', focus: [] });
    expect(parseSectionHash('#nulle-part/lights')).toEqual({ section: 'accueil', focus: [] });
  });

  it('reads the widgets to unfold after the section', () => {
    expect(parseSectionHash('#maison/lights')).toEqual({ section: 'maison', focus: ['lights'] });
    expect(parseSectionHash('#animaux/feeder+fountain+')).toEqual({
      section: 'animaux',
      focus: ['feeder', 'fountain'],
    });
  });

  it('links to the section of a widget with only that widget unfolded', () => {
    expect(widgetHref('lights')).toBe('#maison/lights');
    expect(widgetHref('electricity', 'gas', 'water')).toBe('#energie/electricity+gas+water');
  });

  it('links to one part of a widget and reads it back', () => {
    const href = widgetDetailHref('temperature', 'sensor.cave_temperature');
    expect(href).toBe('#maison/temperature/sensor.cave_temperature');
    expect(parseSectionHash(href)).toEqual({
      section: 'maison',
      focus: ['temperature'],
      detail: 'sensor.cave_temperature',
    });
    expect(parseSectionHash(widgetDetailHref('temperature', 'a/b c'))).toMatchObject({
      detail: 'a/b c',
    });
  });

  it('ignores a detail without a widget, on the home page or badly encoded', () => {
    expect(parseSectionHash('#maison//sensor.cave')).toEqual({ section: 'maison', focus: [] });
    expect(parseSectionHash('#accueil/temperature/sensor.cave')).toEqual({
      section: 'accueil',
      focus: [],
    });
    expect(parseSectionHash('#maison/temperature/%E0%A4%A')).not.toHaveProperty('detail');
  });
});
