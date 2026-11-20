/** a11y tests — a toggling row reacts to Enter and Space like a button, not to keys of nested controls. */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { toggleProps } from './a11y';

const Row = ({ onToggle }: { onToggle: () => void }) => (
  <div data-testid="row" {...toggleProps(false, onToggle)}>
    <input aria-label="inner" />
  </div>
);

describe('toggleProps', () => {
  it('is focusable, exposes its state and toggles on click, Enter and Space', () => {
    const onToggle = vi.fn();
    render(<Row onToggle={onToggle} />);
    const row = screen.getByTestId('row');

    expect(row).toHaveAttribute('tabindex', '0');
    expect(row).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    fireEvent.keyDown(row, { key: 'a' });

    expect(onToggle).toHaveBeenCalledTimes(3);
  });

  it('leaves the keys of a nested control alone', () => {
    const onToggle = vi.fn();
    render(<Row onToggle={onToggle} />);

    fireEvent.keyDown(screen.getByLabelText('inner'), { key: 'Enter' });

    expect(onToggle).not.toHaveBeenCalled();
  });
});
