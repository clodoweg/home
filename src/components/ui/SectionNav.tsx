/**
 * SectionNav — Navigation between the sections: a row of pills in the header on a computer, a
 * floating bar at the bottom of the screen on a phone. Each item is a link to the section's hash.
 */
import React from 'react';

import type { Section, SectionId } from '../../constants/sections';
import { cn } from '../../lib/utils';

interface SectionNavProps {
  sections: readonly Section[];
  current: SectionId;
  /** `pills`: labels in a row (header). `bar`: icons in a floating bar, label on the current one. */
  variant: 'pills' | 'bar';
  className?: string;
}

/**
 * Links to the sections the user can open.
 *
 * @param props - Sections, current section and layout variant.
 * @returns The navigation.
 */
export const SectionNav = ({ sections, current, variant, className }: SectionNavProps) => {
  if (variant === 'bar') {
    // A phone (366 px of bar on an iPhone 14) fits six icons and one label; beyond, the current
    // section is only highlighted, its name being the page title.
    const showLabel = sections.length <= 6;
    return (
      <nav
        aria-label="Sections"
        className={cn(
          'fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex flex-row items-center justify-between gap-1 rounded-full border border-border bg-card p-1.5 shadow-2xl shadow-black/30',
          className,
        )}
      >
        {sections.map(({ id, label, icon: Icon }) => {
          const active = id === current;
          return (
            <a
              key={id}
              href={`#${id}`}
              data-testid={`nav-${id}`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-12 min-w-11 flex-row items-center justify-center gap-2 rounded-full px-3 transition-colors',
                active
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : 'text-muted-foreground active:bg-secondary',
              )}
            >
              <Icon size={20} aria-hidden="true" className="shrink-0" />
              {active && showLabel && <span className="text-sm">{label}</span>}
            </a>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Sections"
      className={cn('flex flex-row items-center gap-1 rounded-full bg-card p-1', className)}
    >
      {sections.map(({ id, label }) => {
        const active = id === current;
        return (
          <a
            key={id}
            href={`#${id}`}
            data-testid={`nav-${id}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-11 items-center rounded-full px-5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
              active
                ? 'bg-primary font-semibold text-primary-foreground'
                : 'font-medium text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
};
