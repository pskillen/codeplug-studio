import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { BatteryLadder } from '@integrations/radio-io/debugView';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import BatteryChart from './BatteryChart.tsx';

const wrap = (ui: ReactNode) => render(<DesignSystemV2Provider>{ui}</DesignSystemV2Provider>);

const ladder = (over: Partial<BatteryLadder> = {}): BatteryLadder => ({
  kind: 'battery',
  id: 'bat',
  title: 'Battery',
  meaning: 'm',
  table: { key: { label: 'Step' }, rows: [], columns: [] },
  steps: [
    { id: 's1', label: 'Step 1', raw: 26 },
    { id: 's2', label: 'Step 2', raw: 40, volts: 3.7 },
    { id: 's3', label: 'Step 3', raw: undefined },
  ],
  ...over,
});

describe('BatteryChart', () => {
  it('puts the highest step on top and shows raw with volts', () => {
    wrap(<BatteryChart chart={ladder()} />);
    const labels = screen.getAllByText(/^Step \d$/).map((e) => e.textContent);
    expect(labels).toEqual(['Step 3', 'Step 2', 'Step 1']);
    expect(screen.getByText('0x1A (26)')).toBeInTheDocument();
    expect(screen.getByText('0x28 (40), 3.7 V')).toBeInTheDocument();
    expect(screen.getByText('Not captured')).toBeInTheDocument();
  });

  it('explains an erased ladder instead of drawing bars', () => {
    wrap(<BatteryChart chart={ladder({ blank: 'All read 0xFF' })} />);
    expect(screen.getByText('All read 0xFF')).toBeInTheDocument();
    expect(screen.queryByText('Step 1')).toBeNull();
  });

  it('draws the overlay as a second named column', () => {
    wrap(<BatteryChart chart={ladder()} overlay={ladder()} readLabel="B" overlayLabel="A" />);
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getAllByText('0x1A (26)')).toHaveLength(2);
  });
});
