/** WidgetHighlight — Coloured value inside a widget subtitle. */
import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Coloured value inside a widget subtitle.
 *
 * @param props - Content and colour class.
 * @returns The highlighted text.
 */
export const WidgetHighlight = ({
  children,
  colorClass,
  className,
}: {
  children: ReactNode;
  colorClass: string;
  className?: string;
}) => <span className={cn('font-medium', colorClass, className)}>{children}</span>;
