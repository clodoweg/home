/**
 * BaseWidget — Bento tile used by every dashboard widget.
 * Handles collapse state (global via WidgetPreferencesContext or local fallback), on a phone
 * only, animated expand/collapse via motion, and the standard header: tone chip, title, subtitle.
 */
import React, { ReactNode, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ChevronDown } from 'lucide-react';

import { useWidgetPreferences } from '../../context/WidgetPreferencesContext';
import { TONE_CLASSES, WIDGET_CONFIG, type Tone } from '../../constants/widgets';
import { WidgetHighlight } from './WidgetHighlight';
import { cn } from '../../lib/utils';
import type { IconComponent } from '../../types/icon';

export { WidgetHighlight };

interface BaseWidgetProps {
  id?: string;
  testID?: string;
  title: string;
  subtitle?: ReactNode | ReactNode[];
  icon: IconComponent;
  /** Chip colour; defaults to the tone of the widget's domain (`WIDGET_CONFIG[id].tone`). */
  tone?: Tone;
  /** Greys the chip out: the device is off or unreachable. */
  muted?: boolean;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}

const HEADER_CLASSES = 'flex w-full flex-row items-center gap-3';

/**
 * Collapsible widget tile: header (tone chip, title, subtitle) and animated body.
 *
 * @param props - Widget id (collapse state kept in preferences), texts, icon, tone, content and ref.
 * @returns The widget.
 */
export const BaseWidget = (props: BaseWidgetProps) => {
  const { canFold, isCollapsed, setCollapsed: setGlobalCollapsed } = useWidgetPreferences();
  const [localCollapsed, setLocalCollapsed] = useState(false);

  const {
    id,
    testID,
    title,
    subtitle,
    icon: Icon,
    tone = (id && WIDGET_CONFIG[id]?.tone) || 'neutral',
    muted = false,
    children,
    className,
    style,
    ref,
  } = props;

  const collapsed = id ? isCollapsed(id) : canFold && localCollapsed;

  const toggleCollapsed = () => {
    if (id) setGlobalCollapsed(id, !collapsed);
    else setLocalCollapsed(!collapsed);
  };

  const heading = (
    <>
      {Icon && (
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full',
            muted ? 'bg-secondary text-muted-foreground' : TONE_CLASSES[tone],
          )}
        >
          <Icon size={20} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg font-semibold text-foreground">
          {title || 'Widget'}
        </span>
        {Array.isArray(subtitle) ? (
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle.map((item, index) => (
              // Fixed parts of a subtitle, in a fixed order: the position is their identity.
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <React.Fragment key={index}>
                {item}
                {index < subtitle.length - 1 ? ' · ' : ''}
              </React.Fragment>
            ))}
          </span>
        ) : typeof subtitle === 'string' ? (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : (
          subtitle
        )}
      </span>
    </>
  );

  return (
    <div
      ref={ref}
      data-testid={testID || (id ? `widget-${id}` : undefined)}
      className={cn('w-full scroll-mt-28', className)}
      style={style}
    >
      <div className="w-full overflow-hidden rounded-tile bg-card p-4 sm:p-5">
        {canFold ? (
          <button
            type="button"
            data-testid={id ? `widget-header-${id}` : undefined}
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
            className={cn(
              HEADER_CLASSES,
              'rounded-2xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
            )}
          >
            {heading}
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={cn(
                'shrink-0 text-muted-foreground transition-transform duration-200',
                !collapsed && 'rotate-180',
              )}
            />
          </button>
        ) : (
          <div data-testid={id ? `widget-header-${id}` : undefined} className={HEADER_CLASSES}>
            {heading}
          </div>
        )}

        <AnimatePresence initial={false}>
          {!collapsed && (
            <m.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-4">{children}</div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
