/** AreaIcon — Icon of a room: the user's choice, or one guessed from the room name. */
import React from 'react';
import { getIconForArea } from '../../utils/areaIcons';

interface AreaIconProps {
  area: string;
  roomIcons?: Record<string, string>;
  size?: number;
  className?: string;
}

/**
 * Renders the icon of a room.
 *
 * @param props - Room name, custom icons and icon size/class.
 * @returns The icon.
 */
export const AreaIcon = ({ area, roomIcons, size, className }: AreaIconProps) =>
  React.createElement(getIconForArea(area, roomIcons), { size, className });
