import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import LineChart from './LineChart.tsx';
import { niceTicks, yAxisFor } from './lineChartScale.ts';

const flat = [
  {
    id: 'a',
    label: 'A',
    slot: 0,
    points: [
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    ],
  },
];

describe('lineChartScale', () => {
  it('integer ticks never go below a step of 1', () => {
    expect(niceTicks(0, 1, 5, true)).toEqual([0, 1]);
  });

  it('an all-zero series gets a 0–1 integer domain', () => {
    expect(yAxisFor([0, 0, 0])).toEqual({ lo: 0, hi: 1, ticks: [0, 1] });
  });

  it('a constant series has distinct ticks', () => {
    const { ticks } = yAxisFor([7, 7]);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it('a flat fixed domain is widened', () => {
    expect(yAxisFor([], [3, 3]).hi).toBe(4);
  });
});

describe('LineChart', () => {
  it('draws the Table fold by default and hides it with table={false}', () => {
    const { container, rerender } = render(
      <MantineProvider>
        <LineChart title="t" xLabel="x" yLabel="y" series={flat} />
      </MantineProvider>,
    );
    expect(container.querySelector('details')).not.toBeNull();
    rerender(
      <MantineProvider>
        <LineChart title="t" xLabel="x" yLabel="y" series={flat} table={false} />
      </MantineProvider>,
    );
    expect(container.querySelector('details')).toBeNull();
  });

  it('labels a flat chart with two distinct y ticks', () => {
    render(
      <MantineProvider>
        <LineChart title="t" xLabel="x" yLabel="y" series={flat} table={false} />
      </MantineProvider>,
    );
    expect(screen.getAllByText('0')).toHaveLength(1);
    expect(screen.getAllByText('1')).toHaveLength(1);
  });
});
