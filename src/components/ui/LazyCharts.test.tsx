/** LazyCharts tests — a chart chunk that fails to load offers a reload instead of breaking the widget. */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./WidgetChart', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

describe('LazyCharts', () => {
  it('shows a reload offer when the chart cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { WidgetChart } = await import('./LazyCharts');

    render(<WidgetChart series={[]} labels={[]} width={300} />);

    expect(await screen.findByText('Graphique indisponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recharger' })).toBeInTheDocument();
  });
});
