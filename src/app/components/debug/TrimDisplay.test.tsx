import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { TrimView } from '@integrations/radio-io/debugView';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import TrimDisplay from './TrimDisplay.tsx';
import { trimPpm, trimValueText } from './trimText.ts';

const wrap = (ui: ReactNode) => render(<DesignSystemV2Provider>{ui}</DesignSystemV2Provider>);

const trim = (over: Partial<TrimView> = {}): TrimView => ({
  kind: 'trim',
  id: 't',
  title: 'Trim',
  meaning: 'm',
  table: { key: { label: 'Index' }, rows: [], columns: [] },
  raw: 12,
  scale: { min: 0, max: 16, neutral: 8 },
  ppm: { perStep: 0.5, span: 4 },
  ...over,
});

describe('TrimDisplay', () => {
  it('computes ppm from the neutral and step', () => {
    expect(trimPpm(trim(), 12)).toBe(2);
    expect(trimPpm(trim({ ppm: undefined }), 12)).toBeUndefined();
    expect(trimValueText(trim(), 12)).toBe('0x0C (12), +2 ppm');
    expect(trimValueText(trim(), 6)).toBe('0x06 (6), -1 ppm');
    expect(trimValueText(trim(), undefined)).toBe('Not captured');
  });

  it('with ppm: value line, ticks, no unknown-scale label', () => {
    const { container } = wrap(<TrimDisplay chart={trim()} />);
    expect(screen.getByText('0x0C (12), +2 ppm')).toBeInTheDocument();
    expect(screen.queryByText('ppm scale unknown')).toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('without ppm: raw scale labelled unknown, neutral tick', () => {
    wrap(
      <TrimDisplay chart={trim({ ppm: undefined, scale: { min: 0, max: 255, neutral: 128 } })} />,
    );
    expect(screen.getByText('ppm scale unknown')).toBeInTheDocument();
    expect(screen.getByText('255')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('draws a hollow overlay marker and both value lines', () => {
    const { container } = wrap(
      <TrimDisplay chart={trim()} overlay={trim({ raw: 4 })} readLabel="B" overlayLabel="A" />,
    );
    expect(screen.getAllByText('B: 0x0C (12), +2 ppm')[0]).toBeInTheDocument();
    expect(screen.getAllByText('A: 0x04 (4), -2 ppm')[0]).toBeInTheDocument();
    const circles = [...container.querySelectorAll('circle')];
    expect(circles).toHaveLength(2);
    expect(circles[1].getAttribute('fill')).toBe('var(--mantine-color-body)');
  });

  it('shows outOfRange text and draws no marker off the scale', () => {
    const { container } = wrap(
      <TrimDisplay chart={trim({ raw: 40, outOfRange: 'Above 16 the firmware uses 8' })} />,
    );
    expect(screen.getByText('Above 16 the firmware uses 8')).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('says Off scale for a value beyond the scale when the model has no text', () => {
    const { rerender } = wrap(<TrimDisplay chart={trim({ raw: 40 })} />);
    expect(screen.getByText('Off scale')).toBeInTheDocument();
    rerender(
      <DesignSystemV2Provider>
        <TrimDisplay chart={trim({ raw: 40, outOfRange: 'Above 16 uses index 8' })} />
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByText('Off scale')).toBeNull();
    expect(screen.getByText('Above 16 uses index 8')).toBeInTheDocument();
  });
});
