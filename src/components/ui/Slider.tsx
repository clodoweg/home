/**
 * Slider — Horizontal range slider built on pointer events.
 *
 * API:
 *   - `value` / `defaultValue` (number or [number])
 *   - `onValueChange(number[])` while dragging, `onSlidingStart()` and
 *     `onSlidingComplete(number[])` around the gesture (callers commit there)
 *   - `min` / `max` / `step`
 *
 * The track is a plain `<div>` that captures `pointerdown/move/up` events and
 * computes the value from the pointer X relative to its bounding rect, so it
 * behaves identically with mouse, touch and pen input.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

interface SliderProps {
  value?: number | number[];
  defaultValue?: number | number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  className?: string;
  style?: React.CSSProperties;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number[]) => void;
  disabled?: boolean;
  testID?: string;
}

function normalizeValue(value: number | number[] | undefined, fallback: number): number {
  if (Array.isArray(value)) return value[0] ?? fallback;
  if (typeof value === 'number') return value;
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Horizontal range slider driven by pointer events.
 *
 * @param props - Value, bounds and change callbacks.
 * @returns The slider.
 */
export const Slider = ({
  value: controlledValue,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
  style,
  onSlidingStart,
  onSlidingComplete,
  disabled = false,
  testID,
}: SliderProps) => {
  const initialValue = normalizeValue(controlledValue ?? defaultValue, min);

  const [isInteracting, setIsInteracting] = useState(false);
  const [internalValue, setInternalValue] = useState(initialValue);
  const valueRef = useRef(internalValue);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const currentValue = isInteracting
    ? internalValue
    : normalizeValue(controlledValue, internalValue);

  useEffect(() => {
    if (!isInteracting) valueRef.current = currentValue;
  }, [currentValue, isInteracting]);

  const configRef = useRef({ min: min, max: max, step });
  const callbacksRef = useRef({ onValueChange, onSlidingStart, onSlidingComplete });
  useEffect(() => {
    configRef.current = { min: min, max: max, step };
    callbacksRef.current = { onValueChange, onSlidingStart, onSlidingComplete };
  }, [min, max, step, onValueChange, onSlidingStart, onSlidingComplete]);

  const calculateValue = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return valueRef.current;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return valueRef.current;

    const { min: cMin, max: cMax, step: cStep } = configRef.current;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const raw = cMin + ratio * (cMax - cMin);
    const stepped = Math.round(raw / cStep) * cStep;
    return clamp(stepped, cMin, cMax);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as HTMLDivElement).setPointerCapture?.(e.pointerId);
    setIsInteracting(true);
    callbacksRef.current.onSlidingStart?.();

    const newValue = calculateValue(e.clientX);
    setInternalValue(newValue);
    valueRef.current = newValue;
    callbacksRef.current.onValueChange?.([newValue]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInteracting || disabled) return;
    const newValue = calculateValue(e.clientX);
    if (newValue === valueRef.current) return;
    setInternalValue(newValue);
    valueRef.current = newValue;
    callbacksRef.current.onValueChange?.([newValue]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInteracting) return;
    (e.target as HTMLDivElement).releasePointerCapture?.(e.pointerId);
    setIsInteracting(false);
    callbacksRef.current.onSlidingComplete?.([valueRef.current]);
  };

  const percentage = useMemo(() => {
    const range = max - min;
    if (range === 0) return 0;
    return clamp(((currentValue - min) / range) * 100, 0, 100);
  }, [currentValue, min, max]);

  return (
    <div
      ref={trackRef}
      data-testid={testID}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={currentValue}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        'relative flex h-10 w-full touch-none items-center select-none',
        disabled && 'opacity-50',
        className,
      )}
      style={style}
    >
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percentage}%` }} />
      </div>
      <div
        className="absolute size-6 rounded-full border-4 border-primary bg-background shadow-md"
        style={{ left: `${percentage}%`, marginLeft: -12 }}
      />
    </div>
  );
};

Slider.displayName = 'Slider';
