import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type {
  BatteryLadder,
  FrequencyCurve,
  NumericTableView,
  StepBars,
  TrimView,
} from '@integrations/radio-io/debugView';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import CalibrationChartCard, { CARD_CHART_KINDS } from './CalibrationChartCard.tsx';
import CalibrationChartGrid from './CalibrationChartGrid.tsx';
import FrequencyCurveChart from './FrequencyCurveChart.tsx';
import StepBarChart, { stepBarDomain } from './StepBarChart.tsx';
import { axisTitle, numericDiffCount } from './chartText.ts';

const wrap = (ui: ReactNode) => render(<DesignSystemV2Provider>{ui}</DesignSystemV2Provider>);

const table = (a: (number | undefined)[], b: (number | undefined)[]): NumericTableView => ({
  key: { label: 'Index' },
  rows: a.map((_, i) => ({ key: String(i) })),
  columns: [
    { id: 'lo', label: 'Low', width: 1, values: a },
    { id: 'hi', label: 'High', width: 1, values: b },
  ],
});

const curve = (over: Partial<FrequencyCurve> = {}, t = table([1, 2], [3, 4])): FrequencyCurve => ({
  kind: 'frequency-curve',
  id: 'power',
  title: 'Band A power',
  meaning: 'Drive at each MHz.',
  address: '0x0100',
  confidence: { layout: 'traced', meaning: 'inferred' },
  table: t,
  x: { label: 'Frequency', unit: 'MHz' },
  y: { label: 'Drive', unit: 'PWM counts' },
  series: [
    {
      id: 'lo',
      label: 'Low',
      slot: 0,
      points: [
        { x: 100, y: 1 },
        { x: 110, y: 2 },
      ],
    },
    {
      id: 'hi',
      label: 'High',
      slot: 2,
      points: [
        { x: 100, y: 3 },
        { x: 110, y: 4 },
      ],
    },
  ],
  ...over,
});

const bars = (values: (number | undefined)[], over: Partial<StepBars> = {}): StepBars => ({
  kind: 'step-bars',
  id: 'sq',
  title: 'Squelch',
  meaning: 'Threshold per level.',
  table: table([1], [1]),
  x: { label: 'Level' },
  y: { label: 'Count', unit: 'counts', domain: 'auto' },
  bars: values.map((value, i) => ({ id: `b${i}`, label: String(i + 1), value })),
  ...over,
});

describe('chart helpers', () => {
  it('adds units to axis titles once', () => {
    expect(axisTitle('Drive', 'PWM counts')).toBe('Drive (PWM counts)');
    expect(axisTitle('MHz', 'MHz')).toBe('MHz');
    expect(axisTitle('Drive (PWM counts)', 'PWM counts')).toBe('Drive (PWM counts)');
  });

  it('counts differing numbers by column id and row', () => {
    expect(numericDiffCount(table([1, 2], [3, 4]), table([1, 2], [3, 4]))).toBe(0);
    expect(numericDiffCount(table([1, 2], [3, 4]), table([1, 9], [3, 5]))).toBe(2);
    expect(numericDiffCount(table([1, undefined], [3, 4]), table([1, undefined], [3, 4]))).toBe(0);
  });
});

describe('FrequencyCurveChart', () => {
  it('titles axes with units, shows the legend and has no own Table fold', () => {
    const { container } = wrap(<FrequencyCurveChart chart={curve()} />);
    expect(screen.getByText('Drive (PWM counts)')).toBeInTheDocument();
    expect(screen.getByText('Frequency (MHz)')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(container.querySelector('details')).toBeNull();
  });

  it('draws the overlay dashed in the same slot and leaves a gap for a missing entry', () => {
    const c = curve();
    const o = curve({
      series: [
        {
          id: 'lo',
          label: 'Low',
          slot: 5,
          points: [
            { x: 100, y: 1 },
            { x: 105, y: NaN },
            { x: 110, y: 2 },
          ],
        },
      ],
    });
    const { container } = wrap(<FrequencyCurveChart chart={c} overlay={o} overlayLabel="A" />);
    const lines = [...container.querySelectorAll('polyline')];
    const dashed = lines.filter((l) => l.getAttribute('stroke-dasharray'));
    // Two lone points around the NaN gap: drawn as dots, not a joined line.
    expect(dashed).toHaveLength(0);
    expect(container.querySelectorAll('circle').length).toBe(2);
    expect(screen.getByText('Low (A)')).toBeInTheDocument();
    const solid = lines.map((l) => l.getAttribute('stroke'));
    expect(new Set(solid).size).toBe(2);
  });
});

describe('StepBarChart', () => {
  it('scales auto to the data and says so', () => {
    wrap(<StepBarChart chart={bars([1, 2, 3])} />);
    expect(screen.getByText('scale 0–3')).toBeInTheDocument();
    expect(screen.getByText('Count (counts)')).toBeInTheDocument();
    expect(screen.getByText('Level')).toBeInTheDocument();
  });

  it('has no scale note for a fixed domain', () => {
    wrap(
      <StepBarChart chart={bars([1], { y: { label: 'Byte', unit: 'raw', domain: [0, 255] } })} />,
    );
    expect(screen.queryByText(/^scale/)).toBeNull();
  });

  it('draws outlined overlay bars and a dash for a missing value', () => {
    const { container } = wrap(
      <StepBarChart chart={bars([2, undefined])} overlay={bars([3, 1])} overlayLabel="A" />,
    );
    const rects = [...container.querySelectorAll('rect')];
    expect(rects.filter((r) => r.getAttribute('fill') === 'none')).toHaveLength(2);
    expect(container.querySelector('title')?.textContent).toBeTruthy();
    expect(container.textContent).toContain('Not captured');
  });

  it('auto domain reaches below zero for a negative value and bars grow from the zero line', () => {
    const c = bars([-4, 6]);
    const d = stepBarDomain(c);
    expect(d.lo).toBeLessThan(0);
    expect(d.hi).toBeGreaterThanOrEqual(6);
    expect(d.ticks).toContain(0);
    const { container } = wrap(<StepBarChart chart={c} />);
    const rects = [...container.querySelectorAll('rect')];
    const y = (i: number) => Number(rects[i]!.getAttribute('y'));
    const h = (i: number) => Number(rects[i]!.getAttribute('height'));
    // The negative bar hangs below the line the positive bar stands on.
    expect(y(0)).toBeCloseTo(y(1) + h(1));
    expect(h(0)).toBeGreaterThan(1);
  });

  it('domain helper: unset behaves like auto', () => {
    const c = bars([5]);
    const noDomain = { ...c, y: { label: 'x', unit: 'u' } } as StepBars;
    expect(stepBarDomain(noDomain).auto).toBe(true);
  });
});

describe('CalibrationChartCard', () => {
  it('shows title, address, badges, meaning and folds the numeric table', () => {
    wrap(<CalibrationChartCard chart={curve()} />);
    expect(screen.getByRole('heading', { name: 'Band A power' })).toBeInTheDocument();
    expect(screen.getByText('0x0100')).toBeInTheDocument();
    expect(screen.getByText('traced')).toBeInTheDocument();
    expect(screen.getByText('Drive at each MHz.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Numeric table/ }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText(/same in both|differ/)).toBeNull();
  });

  it('About folds: about text plus the discrete note', () => {
    wrap(<CalibrationChartCard chart={curve({ about: 'Index rule.', discrete: true })} />);
    expect(screen.queryByText('Index rule.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /About this chart/ }));
    expect(screen.getByText('Index rule.')).toBeInTheDocument();
    expect(
      screen.getByText('Lines join neighbouring entries as a guide only.'),
    ).toBeInTheDocument();
  });

  it('has no About fold when there is nothing to say', () => {
    wrap(<CalibrationChartCard chart={curve()} />);
    expect(screen.queryByRole('button', { name: /About this chart/ })).toBeNull();
  });

  it('diff badge: same in both, and N values differ', () => {
    const { unmount } = wrap(<CalibrationChartCard chart={curve()} overlay={curve()} />);
    expect(screen.getByText('same in both')).toBeInTheDocument();
    unmount();
    wrap(<CalibrationChartCard chart={curve()} overlay={curve({}, table([1, 9], [3, 5]))} />);
    expect(screen.getByText('2 values differ')).toBeInTheDocument();
  });

  it('renders step bars and ignores an overlay of another kind', () => {
    wrap(<CalibrationChartCard chart={bars([1, 2])} overlay={curve()} />);
    expect(screen.getByRole('img', { name: 'Squelch' })).toBeInTheDocument();
    expect(screen.queryByText(/same in both|differ/)).toBeNull();
  });

  it('renders battery and trim charts, passing the overlay through', () => {
    const battery: BatteryLadder = {
      kind: 'battery',
      id: 'b',
      title: 'Battery',
      meaning: 'm',
      table: table([1], [1]),
      steps: [{ id: 's1', label: 'Step 1', raw: 26 }],
    };
    const trim: TrimView = {
      kind: 'trim',
      id: 't',
      title: 'Trim',
      meaning: 'm',
      table: table([1], [1]),
      raw: 12,
      scale: { min: 0, max: 16 },
    };
    const { unmount } = wrap(<CalibrationChartCard chart={battery} overlay={battery} />);
    expect(screen.getByRole('heading', { name: 'Battery' })).toBeInTheDocument();
    expect(screen.getAllByText('0x1A (26)')).toHaveLength(2);
    unmount();
    wrap(<CalibrationChartCard chart={trim} overlay={{ ...trim, raw: 4 }} />);
    expect(screen.getByRole('img', { name: 'Trim' })).toBeInTheDocument();
    expect(screen.getAllByText('Overlay: 0x04 (4)')[0]).toBeInTheDocument();
  });

  it('lists every drawn kind', () => {
    expect([...CARD_CHART_KINDS].sort()).toEqual([
      'battery',
      'frequency-curve',
      'step-bars',
      'trim',
    ]);
  });
});

describe('CalibrationChartGrid', () => {
  it('renders its children', () => {
    wrap(
      <CalibrationChartGrid>
        <div>one</div>
        <div>two</div>
      </CalibrationChartGrid>,
    );
    expect(screen.getByText('two')).toBeInTheDocument();
  });
});
