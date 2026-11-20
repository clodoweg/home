/** Skeleton — Pulsing placeholder shown while a widget loads. */
import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Skeleton — Pulsing placeholder using Tailwind's `animate-pulse`.
 */
const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('animate-pulse rounded-md bg-secondary', className)} {...props} />
);

export { Skeleton };
