/** Card — Opaque rounded surface for dialogs, list rows and error cards (a widget uses BaseWidget). */
import React, { CSSProperties } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps {
  children?: React.ReactNode;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  testID?: string;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Rounded surface on the card colour.
 *
 * @param props - Content, classes of the outer and inner elements, inline style, test id and ref.
 * @returns The card.
 */
export const Card = ({ children, className, innerClassName, style, testID, ref }: CardProps) => (
  <div
    ref={ref}
    data-testid={testID}
    style={style}
    className={cn('overflow-hidden rounded-tile', className)}
  >
    <div className={cn('h-full bg-card p-4', innerClassName)}>{children}</div>
  </div>
);
