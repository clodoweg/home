/** WeatherIcon tests — colours of the condition icons, on a card and on a coloured tile. */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getWeatherIcon } from './WeatherIcon';

const classesOf = (condition: string | undefined, onTone: boolean) => {
  const { container } = render(getWeatherIcon(condition, 24, onTone));
  return Array.from(container.querySelectorAll('svg')).map((svg) => svg.getAttribute('class'));
};

describe('getWeatherIcon', () => {
  it.each(['cloudy', 'rainy', 'snowy', 'fog', 'windy', 'partlycloudy', undefined])(
    'prend la couleur du texte de la tuile pour %s sur un fond coloré',
    (condition) => {
      expect(classesOf(condition, true)[0]).toContain('text-current');
      expect(classesOf(condition, false)[0]).not.toContain('text-current');
    },
  );

  it('garde le soleil, la lune et la partie soleil de « partiellement nuageux » en jaune', () => {
    expect(classesOf('sunny', true)[0]).toContain('text-warning');
    expect(classesOf('clear-night', true)[0]).toContain('text-warning');
    expect(classesOf('partlycloudy', true)[1]).toContain('text-warning');
  });
});
