/**
 * Button — Reusable button component with CVA-driven variant and size system.
 * Supports icons, loading state, and all design-system variants.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/utils';
import type { IconComponent } from '../../types/icon';

const buttonVariants = cva(
  'inline-flex flex-row items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-secondary active:bg-secondary/80',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
        ghost: 'bg-transparent text-foreground hover:bg-secondary active:bg-secondary/80',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-14 px-8 text-base',
        icon: 'size-11 p-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  label?: string;
  icon?: IconComponent;
  loading?: boolean;
  textClassName?: string;
}

/**
 * Pressable button component with variant, size, icon, and loading state support.
 *
 * @param variant - Visual style (default | destructive | outline | secondary | ghost | link).
 * @param size - Touch target size (default | sm | lg | icon).
 * @param label - Text label rendered inside the button.
 * @param icon - Optional Lucide icon rendered before the label.
 * @param loading - When true, shows a spinner and disables the button.
 */
const Button = ({
  className,
  variant,
  size,
  label,
  icon: Icon,
  loading = false,
  textClassName,
  disabled,
  children,
  onClick,
  type = 'button',
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : null}
      {Icon && !loading ? <Icon size={20} /> : null}
      {label ? <span className={cn(textClassName)}>{label}</span> : null}
      {children}
    </button>
  );
};

export { Button };
