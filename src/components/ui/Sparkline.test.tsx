/** Sparkline.test — Small history chart of the home tiles. */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('scales the series to its own range, oldest point on the left', () => {
    const { container } = render(<Sparkline values={[10, 20, 15]} data-testid="line" />);
    const points = container.querySelector('polyline')?.getAttribute('points');
    expect(points).toBe('0.00,96.00 50.00,4.00 100.00,50.00');
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('polygon')).toBeNull();
  });

  it('shades the area under the line and marks the latest value', () => {
    const { container } = render(<Sparkline values={[10, 20, 15]} area endDot />);
    expect(container.querySelector('polygon')?.getAttribute('points')).toBe(
      '0,100 0.00,96.00 50.00,4.00 100.00,50.00 100,100',
    );
    expect(container.querySelector<HTMLElement>('span > span')?.style.top).toBe('50%');
  });

  it('draws a flat series at mid-height', () => {
    const { container } = render(<Sparkline values={[5, 5]} />);
    expect(container.querySelector('polyline')?.getAttribute('points')).toBe(
      '0.00,50.00 100.00,50.00',
    );
  });

  it('draws nothing with fewer than two points', () => {
    const { container } = render(<Sparkline values={[5]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
