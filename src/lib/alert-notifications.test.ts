/** alert-notifications tests — the widget an alert opens and how a push payload is read. */
import { describe, expect, it } from 'vitest';
import { alertHref, parseAlertPush } from './alert-notifications';

describe('alertHref', () => {
  it.each([
    ['alarm', '#securite/alarm'],
    ['motion', '#securite/arlo'],
    ['lights', '#maison/lights'],
    ['humidity', '#maison/temperature'],
    ['feeder', '#animaux/feeder'],
  ])('opens the widget of a %s alert', (category, href) => {
    expect(alertHref(category)).toBe(href);
  });

  it('opens the home screen for an unknown category', () => {
    expect(alertHref('unknown')).toBe('#');
  });
});

describe('parseAlertPush', () => {
  it('reads the payload the back sends', () => {
    expect(parseAlertPush({ id: 4, title: 'Spa', body: '34 °C', category: 'spa' })).toEqual({
      id: 4,
      title: 'Spa',
      body: '34 °C',
      category: 'spa',
    });
  });

  it.each([null, 'text', 42, { title: '', id: '4' }])(
    'still gives a notification for %j',
    (payload) => {
      expect(parseAlertPush(payload)).toEqual({ id: null, title: 'Home', body: '', category: '' });
    },
  );
});
