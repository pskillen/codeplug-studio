import { useComputedColorScheme } from '@mantine/core';
import type { TrimView } from '@integrations/radio-io/debugView';
import { lineChartSlotColor } from '../LineChart/lineChartScale.ts';
import { neutralOf, trimValueText } from './trimText.ts';
import classes from './TrimDisplay.module.css';

export interface TrimDisplayProps {
  chart: TrimView;
  /** The same trim from a second read, drawn as a hollow marker. */
  overlay?: TrimView;
  readLabel?: string;
  overlayLabel?: string;
}

const W = 320;
const PAD = 20;

/**
 * A trim value on its scale, "not really a slider". With `ppm` it is a centre-zero ppm scale (span from `ppm.span`,
 * else the scale's own reach); without it a raw-scale bar labelled "ppm scale unknown", with a neutral tick when the
 * model has one. The overlay read is a hollow marker. `outOfRange` text sits under the display.
 */
export default function TrimDisplay({ chart, overlay, readLabel, overlayLabel }: TrimDisplayProps) {
  const scheme = useComputedColorScheme('light');
  const { scale, ppm } = chart;
  const neutral = neutralOf(chart);
  const reach = ppm
    ? (ppm.span ?? Math.max(neutral - scale.min, scale.max - neutral) * ppm.perStep)
    : 0;
  /** Position 0..1 along the line for a raw value; undefined when off the scale. */
  const frac = (raw: number): number | undefined => {
    if (ppm) {
      if (reach <= 0) return undefined;
      const p = (raw - neutral) * ppm.perStep;
      return Math.abs(p) <= reach + 1e-9 ? (p + reach) / (2 * reach) : undefined;
    }
    if (scale.max <= scale.min || raw < scale.min || raw > scale.max) return undefined;
    return (raw - scale.min) / (scale.max - scale.min);
  };
  const x = (f: number) => PAD + f * (W - 2 * PAD);

  const ticks: { f: number; text: string; major: boolean }[] = [];
  if (ppm) {
    if (reach > 0) {
      const whole = Math.floor(reach);
      for (let t = -whole; t <= whole; t++) {
        ticks.push({
          f: (t + reach) / (2 * reach),
          text: t > 0 ? `+${t}` : String(t),
          major: t === 0,
        });
      }
    }
  } else {
    ticks.push({ f: 0, text: String(scale.min), major: false });
    ticks.push({ f: 1, text: String(scale.max), major: false });
    const nf = scale.neutral === undefined ? undefined : frac(scale.neutral);
    if (nf !== undefined) ticks.push({ f: nf, text: String(scale.neutral), major: true });
  }

  // A captured value with no marker is off the scale; say so even when the model has no text for it.
  const offScale = [chart, overlay].some((v) => v?.raw !== undefined && frac(v.raw) === undefined);

  const readName = readLabel ?? 'Read';
  const overlayName = overlayLabel ?? 'Overlay';
  const marker = (view: TrimView, slot: number, hollow: boolean, name: string) => {
    if (view.raw === undefined) return null;
    const f = frac(view.raw);
    if (f === undefined) return null;
    const color = lineChartSlotColor(slot, scheme);
    return (
      <circle
        cx={x(f)}
        cy={20}
        r={6}
        fill={hollow ? 'var(--mantine-color-body)' : color}
        stroke={color}
        strokeWidth={2}
      >
        <title>{`${name}: ${trimValueText(view, view.raw)}`}</title>
      </circle>
    );
  };

  return (
    <div className={classes.root}>
      <div className={classes.values}>
        {overlay ? (
          <>
            <div>
              {readName}: {trimValueText(chart, chart.raw)}
            </div>
            <div>
              {overlayName}: {trimValueText(overlay, overlay.raw)}
            </div>
          </>
        ) : (
          <div>{trimValueText(chart, chart.raw)}</div>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} 50`}
        width="100%"
        role="img"
        aria-label={chart.title}
        style={{ display: 'block', maxWidth: W }}
      >
        <line
          x1={x(0)}
          x2={x(1)}
          y1={20}
          y2={20}
          stroke="var(--mantine-color-default-border)"
          strokeWidth={ppm ? 2 : 8}
          strokeLinecap="round"
        />
        {ticks.map((t) => (
          <g key={`${t.f}-${t.text}`}>
            <line
              x1={x(t.f)}
              x2={x(t.f)}
              y1={t.major ? 8 : 14}
              y2={t.major ? 32 : 26}
              stroke="var(--mantine-color-dimmed)"
            />
            <text
              x={x(t.f)}
              y={46}
              fontSize={10}
              textAnchor="middle"
              fill="var(--mantine-color-dimmed)"
            >
              {t.text}
            </text>
          </g>
        ))}
        {marker(chart, 0, false, readName)}
        {overlay ? marker(overlay, 1, true, overlayName) : null}
      </svg>
      {ppm ? null : <div className={classes.note}>ppm scale unknown</div>}
      {chart.outOfRange ? <div className={classes.note}>{chart.outOfRange}</div> : null}
      {offScale && !chart.outOfRange ? <div className={classes.note}>Off scale</div> : null}
    </div>
  );
}
