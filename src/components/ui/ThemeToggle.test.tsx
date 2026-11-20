/** ThemeToggle tests — shows the active theme and switches it through ThemeContext. */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

const themeState = vi.hoisted(() => ({ theme: 'dark' as 'light' | 'dark', setTheme: vi.fn() }));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: themeState.theme,
    setTheme: themeState.setTheme,
    toggleTheme: vi.fn(),
  }),
}));

beforeEach(() => {
  themeState.theme = 'dark';
  themeState.setTheme.mockClear();
});

describe('ThemeToggle', () => {
  it('marks the active theme as pressed', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Thème sombre' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Thème clair' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('asks for the chosen theme', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Thème clair' }));
    expect(themeState.setTheme).toHaveBeenCalledWith('light');

    themeState.theme = 'light';
    render(<ThemeToggle />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Thème sombre' })[1]);
    expect(themeState.setTheme).toHaveBeenCalledWith('dark');
  });
});
