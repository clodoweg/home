/** PowerButton — ON/OFF button of a device. */
import React from 'react';
import { Button, ButtonProps } from './Button';
import { cn } from '../../lib/utils';

interface PowerButtonProps extends Omit<ButtonProps, 'label' | 'variant'> {
  isOn: boolean;
}

/**
 * ON/OFF button of a device.
 *
 * @param props - Device state and button props.
 * @returns The button.
 */
export const PowerButton = ({ isOn, className, textClassName, ...props }: PowerButtonProps) => {
  return (
    <Button
      label={isOn ? 'ON' : 'OFF'}
      variant={isOn ? 'default' : 'outline'}
      className={cn(
        'h-11 w-16',
        isOn && 'bg-accent text-accent-foreground hover:bg-accent/90 active:bg-accent/80',
        className,
      )}
      textClassName={cn('text-xs font-bold', textClassName)}
      data-state={isOn ? 'on' : 'off'}
      {...props}
    />
  );
};
