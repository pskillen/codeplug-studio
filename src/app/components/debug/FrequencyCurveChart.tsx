import type { FrequencyCurve } from '@integrations/radio-io/debugView';
import LineChart, { type LineChartSeries } from '../LineChart/LineChart.tsx';
import { axisTitle } from './chartText.ts';

export interface FrequencyCurveChartProps {
  chart: FrequencyCurve;
  /** The same curve from a second read; series pair by id and draw dashed in the same colour slot. */
  overlay?: FrequencyCurve;
  /** Label for the read's lines when overlaid, appended to each legend entry. */
  readLabel?: string;
  /** Label for the overlay's lines. */
  overlayLabel?: string;
  height?: number;
}

/**
 * A value per frequency, one line per level or path. Axis titles carry units, the legend is always shown, a point
 * with a non-finite y is a missing entry (a gap in the line), and colour follows `slot`, never rank.
 */
export default function FrequencyCurveChart({
  chart,
  overlay,
  readLabel,
  overlayLabel,
  height,
}: FrequencyCurveChartProps) {
  const tag = (label: string, who?: string) => (overlay && who ? `${label} (${who})` : label);
  const series: LineChartSeries[] = chart.series.map((s) => ({
    id: s.id,
    label: tag(s.label, readLabel),
    slot: s.slot,
    points: s.points,
  }));
  if (overlay) {
    for (const o of overlay.series) {
      const base = chart.series.find((s) => s.id === o.id);
      series.push({
        id: `overlay-${o.id}`,
        label: tag(o.label, overlayLabel ?? 'overlay'),
        slot: base?.slot ?? o.slot,
        dashed: true,
        points: o.points,
      });
    }
  }
  return (
    <LineChart
      title={chart.title}
      series={series}
      xLabel={axisTitle(chart.x.label, chart.x.unit)}
      yLabel={axisTitle(chart.y.label, chart.y.unit)}
      yDomain={chart.y.domain}
      height={height}
      showLegend
      table={false}
    />
  );
}
