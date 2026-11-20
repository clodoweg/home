/** ThemeToggle — Two-position light / dark switch shown in the header, saved with the theme. */
import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';

const OPTIONS = [
  { value: 'light', label: 'Thème clair', icon: Sun },
  { value: 'dark', label: 'Thème sombre', icon: Moon },
] as const;

/**
 * Light / dark switch: the active theme is highlighted; choosing one applies it at once and saves
 * it in the user's preferences (through `ThemeContext`, which rolls back if the save fails).
 *
 * @returns The switch, as a group of two pressed / unpressed buttons.
 */
export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Thème"
      data-testid="theme-toggle"
      className="flex flex-row items-center gap-0.5 rounded-full bg-secondary p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={`theme-toggle-${value}`}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'flex size-9 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        );
      })}
    </div>
  );
};
