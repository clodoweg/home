/** a11y — Keyboard support for elements that toggle on click but are not buttons (table rows, cards). */
import type React from 'react';

/**
 * Props that let a non-button element toggle with Enter or Space, like a button.
 *
 * @param expanded - Whether the controlled content is shown.
 * @param onToggle - Toggles the content.
 * @returns Props to spread on the element (focusable, `aria-expanded`, click and key handlers).
 */
export function toggleProps(expanded: boolean, onToggle: () => void) {
  return {
    tabIndex: 0,
    'aria-expanded': expanded,
    onClick: onToggle,
    onKeyDown: (e: React.KeyboardEvent) => {
      // Keys typed in a nested control (slider, switch) belong to that control.
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
    },
  };
}
