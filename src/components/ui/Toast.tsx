/** Toast — Notification banner primitives rendered by Toaster (see hooks/use-toast). */
import * as React from 'react';
import { m, AnimatePresence, type HTMLMotionProps } from 'motion/react';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const ToastProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const ToastViewport = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'pointer-events-none fixed inset-x-0 top-0 z-100 mx-auto flex w-full max-w-lg flex-col-reverse gap-2 p-4',
      className,
    )}
    {...props}
  />
);

const toastVariants = cva(
  'pointer-events-auto flex w-full flex-row items-center justify-between gap-4 overflow-hidden rounded-3xl p-5 shadow-2xl shadow-black/30',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface ToastProps
  extends Omit<HTMLMotionProps<'div'>, 'variant'>, VariantProps<typeof toastVariants> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Toast = ({
  className,
  variant,
  open = true,
  onOpenChange: _onOpenChange,
  children,
  ...props
}: ToastProps) => (
  <AnimatePresence>
    {open ? (
      <m.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
        className={cn(toastVariants({ variant }), className)}
        {...props}
      >
        {children}
      </m.div>
    ) : null}
  </AnimatePresence>
);

const ToastClose = ({ className, type = 'button', ...props }: React.ComponentProps<'button'>) => (
  <button
    type={type}
    aria-label="Fermer"
    className={cn(
      'absolute top-2 right-2 rounded-full p-1 opacity-70 hover:opacity-100',
      className,
    )}
    {...props}
  >
    <X size={16} />
  </button>
);

const ToastTitle = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span className={cn('text-sm font-semibold', className)} {...props} />
);

const ToastDescription = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span className={cn('text-sm opacity-90', className)} {...props} />
);

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose };
