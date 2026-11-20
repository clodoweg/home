/**
 * OverlayMenu — Modal used for the settings, reorder and notifications screens.
 * Mobile: bottom sheet sliding up, with its own close button.
 * Desktop: centered Card with a close button.
 * Backdrop click closes; Escape closes; body scroll is locked while open.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserProfile } from '../../context/UserContext';
import { Card } from './Card';
import { Button } from './Button';

interface OverlayMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  showDesktopHeader?: boolean;
  desktopWidth?: string;
  desktopMaxHeight?: string;
}

/**
 * Modal menu over the dashboard (bottom sheet on mobile, centered card on desktop).
 *
 * @param props - Open state, close callback, title and content.
 * @returns The menu in a portal, or nothing when closed.
 */
export const OverlayMenu = ({
  isOpen,
  onClose,
  children,
  title,
  showDesktopHeader = false,
  desktopWidth = 'w-[640px]',
  desktopMaxHeight = 'max-h-[80vh] overflow-hidden',
}: OverlayMenuProps) => {
  const { isMobile } = useResponsive();
  const { user } = useUserProfile();

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Keyboard and screen reader users land in the menu, and back on the opener when it closes.
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const footer = (
    <p className="text-center text-sm text-muted-foreground">
      Connecté en tant que {user?.fullName} ({user?.primaryEmailAddress?.emailAddress})
    </p>
  );

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title ?? 'Menu'}
          tabIndex={-1}
          className="fixed inset-0 z-50 outline-hidden"
        >
          {isMobile ? (
            <>
              <m.button
                type="button"
                // Click target only: the sheet's close button and Escape already close the menu
                // for keyboard and screen reader users.
                aria-hidden="true"
                tabIndex={-1}
                onClick={onClose}
                className="absolute inset-0 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <m.div
                className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-tile bg-card"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ duration: 0.2 }}
              >
                <div className="relative p-6">
                  {title && (
                    <p
                      data-testid="overlay-title"
                      className="text-center font-display text-xl font-semibold text-foreground"
                    >
                      {title}
                    </p>
                  )}
                  {/* Touch screens have no Escape key: the sheet carries its own close button. */}
                  <Button
                    data-testid="overlay-close-button-mobile"
                    aria-label="Fermer"
                    variant="ghost"
                    size="icon"
                    icon={X}
                    onClick={onClose}
                    className="absolute top-1/2 right-4 -translate-y-1/2"
                  />
                </div>
                <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
                <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{footer}</div>
              </m.div>
            </>
          ) : (
            <m.div
              className="absolute inset-0 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
              }}
            >
              <Card
                className={cn(desktopWidth, desktopMaxHeight)}
                innerClassName="p-0 flex flex-col"
              >
                <div className={cn('flex flex-col', desktopMaxHeight)}>
                  {(showDesktopHeader || title) && (
                    <div className="flex flex-row items-center justify-between p-6">
                      <div className="flex-1">
                        {title && (
                          <p
                            data-testid="overlay-title"
                            className="font-display text-2xl font-semibold text-foreground"
                          >
                            {title}
                          </p>
                        )}
                      </div>
                      <Button
                        data-testid="overlay-close-button"
                        aria-label="Fermer"
                        variant="ghost"
                        size="icon"
                        icon={X}
                        onClick={onClose}
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
                  <div className="p-6">{footer}</div>
                </div>
              </Card>
            </m.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};
