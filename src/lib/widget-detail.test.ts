/** widget-detail tests — a request reaches its widget only, once, and a newer one is kept. */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearWidgetDetail, requestWidgetDetail, useWidgetDetailRequest } from './widget-detail';

afterEach(() => {
  const { result } = renderHook(() => useWidgetDetailRequest('temperature'));
  if (result.current) clearWidgetDetail(result.current);
});

describe('widget detail requests', () => {
  it('reaches the named widget only', () => {
    const temperature = renderHook(() => useWidgetDetailRequest('temperature'));
    const lights = renderHook(() => useWidgetDetailRequest('lights'));
    expect(temperature.result.current).toBeNull();

    act(() => requestWidgetDetail('temperature', 'sensor.cave'));
    expect(temperature.result.current).toEqual({ widgetId: 'temperature', detail: 'sensor.cave' });
    expect(lights.result.current).toBeNull();
  });

  it('is cleared once handled, but a newer request is kept', () => {
    const { result } = renderHook(() => useWidgetDetailRequest('temperature'));
    act(() => requestWidgetDetail('temperature', 'sensor.cave'));
    const first = result.current!;

    act(() => requestWidgetDetail('temperature', 'sensor.salon'));
    act(() => clearWidgetDetail(first));
    expect(result.current?.detail).toBe('sensor.salon');

    act(() => clearWidgetDetail(result.current!));
    expect(result.current).toBeNull();
  });

  it('gives a new request for the same link followed twice', () => {
    const { result } = renderHook(() => useWidgetDetailRequest('temperature'));
    act(() => requestWidgetDetail('temperature', 'sensor.cave'));
    const first = result.current;
    act(() => requestWidgetDetail('temperature', 'sensor.cave'));
    expect(result.current).not.toBe(first);
  });
});
