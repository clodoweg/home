/**
 * Tailwind CSS Utility
 * Provides a standard wrapper for conditional class name merging and deduplication.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names, later Tailwind classes overriding earlier ones.
 *
 * @param inputs - Class names, arrays or condition maps.
 * @returns The merged class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
