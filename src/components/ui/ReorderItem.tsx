/**
 * ReorderItem — Single row inside the widget/room-reorder list.
 *
 * Exposes two interactive controls:
 * - Visibility toggle (Eye / EyeOff) — calls `onToggleVisibility` when provided.
 * - Drag handle (GripVertical) — `dragHandleProps` is spread on the button so the
 *   parent (ReorderScreen / dnd-kit sortable) can wire up its listeners and attributes.
 *
 * When `isVisible` is false, the row is visually dimmed to signal the item is hidden.
 */
import { TONE_CLASSES, type Tone } from '../../constants/widgets';
import React from 'react';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../../lib/utils';
import type { IconComponent } from '../../types/icon';

interface ReorderItemProps {
  title: string;
  icon: IconComponent;
  tone?: Tone;
  /** Attributes and listeners from @dnd-kit's `useSortable`, spread on the handle. */
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  isActive?: boolean;
  marginBottom?: number;
  /** Whether the item is currently visible on the dashboard / widget. */
  isVisible?: boolean;
  /** Called when the user clicks the Eye toggle. */
  onToggleVisibility?: () => void;
  /** Called when the user clicks the icon itself (to change it). */
  onIconClick?: () => void;
  children?: React.ReactNode;
}

/**
 * A draggable list item inside the reorder screen.
 * Displays an icon (optionally interactive to open an icon picker),
 * a text label, an eye toggle button to hide/show, and a grip handle for dragging.
 * Supports rendering children inside the card.
 *
 * @param props - Component props.
 * @param props.title - Text label of the item.
 * @param props.icon - Lucide icon component.
 * @param props.tone - Domain tone of the icon chip.
 * @param props.dragHandleProps - Drag handle attributes from @dnd-kit.
 * @param props.isActive - Visual state when item is being dragged.
 * @param props.marginBottom - Optional custom margin-bottom.
 * @param props.isVisible - Hidden or visible toggle state.
 * @param props.onToggleVisibility - Callback to toggle visibility.
 * @param props.onIconClick - Callback when the icon is clicked (makes the icon button interactive).
 * @param props.children - Optional nested components to render inside the card under the header.
 * @returns A JSX element rendering a Card row.
 */
export const ReorderItem = ({
  title,
  icon: Icon,
  tone = 'neutral',
  dragHandleProps,
  isActive,
  marginBottom = 12,
  isVisible = true,
  onToggleVisibility,
  onIconClick,
  children,
}: ReorderItemProps) => (
  <Card
    className={cn(
      'w-full border-0 transition-opacity',
      isActive && 'opacity-80',
      !isVisible && 'opacity-50',
    )}
    style={{ marginBottom }}
    innerClassName="p-4 flex flex-col gap-2"
  >
    <div className="flex w-full flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-4">
        {onIconClick ? (
          <button
            type="button"
            onClick={onIconClick}
            aria-label={`Modifier l'icône de ${title}`}
            className={cn(
              'cursor-pointer rounded-full p-2.5 transition-transform duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden active:scale-95',
              TONE_CLASSES[tone],
            )}
          >
            <Icon size={20} />
          </button>
        ) : (
          <div className={cn('rounded-full p-2.5', TONE_CLASSES[tone])}>
            <Icon size={20} />
          </div>
        )}
        <span
          className={cn(
            'text-base font-medium',
            isVisible ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {title}
        </span>
      </div>

      <div className="flex flex-row items-center gap-1">
        {onToggleVisibility && (
          <button
            type="button"
            aria-label={isVisible ? `Masquer ${title}` : `Afficher ${title}`}
            onClick={onToggleVisibility}
            className="rounded-md p-2 transition-colors hover:bg-secondary"
          >
            {isVisible ? (
              <Eye size={18} className="text-muted-foreground" />
            ) : (
              <EyeOff size={18} className="text-muted-foreground/40" />
            )}
          </button>
        )}

        <button
          type="button"
          className="cursor-grab touch-none p-2 active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical size={24} className="text-muted-foreground opacity-50" />
        </button>
      </div>
    </div>
    {children}
  </Card>
);
