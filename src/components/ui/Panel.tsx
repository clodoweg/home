/**
 * Panel — Inner content panel for widget sections: the inset surface used inside a tile for
 * detail sub-panels, expandable sections and info rows. Use BaseWidget or Card for the outer
 * container.
 */
import React from 'react';
import { cn } from '../../lib/utils';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Inner panel of a widget section.
 *
 * @param props - Div props.
 * @returns The panel.
 */
export const Panel = ({ className, children, ...props }: PanelProps) => (
  <div className={cn('rounded-2xl bg-muted p-4', className)} {...props}>
    {children}
  </div>
);
