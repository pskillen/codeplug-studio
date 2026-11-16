import { useComputedColorScheme } from '@mantine/core';
import { formatDecimal, type StepBars } from '@integrations/radio-io/debugView';
import { lineChartSlotColor, niceTicks } from '../LineChart/lineChartScale.ts';
import { axisTitle } from './chartText.ts';

export interface StepBarChartProps {
  chart: StepBars;
  /** The same bars from a second read; bars pair by id and draw outlined beside the filled ones. */
  overlay?: StepBars;
  readLabel?: string;
  overlayLabel?: string;
}

const W = 560;
const H = 170;
const M = { top: 10, right: 8, bottom: 44, left: 40 };

/** The y range of a step chart: `auto` (or unset) scales from 0 (or the lowest negative value) to the data's top tick; a pair is used as given. */
export function stepBarDomain(
  chart: StepBars,
  overlay?: StepBars,
): { lo: number; hi: number; auto: boolean; ticks: number[] } {
  const d = chart.y.domain;
  if (Array.isArray(d)) {
    const [lo, hi] = d as readonly [number, number];
    return { lo, hi: hi > lo ? hi : lo + 1, auto: false, ticks: niceTicks(lo, hi, 4, true) };
  }
  const values = [...chart.bars, ...(overlay?.bars ?? [])]
    .map((b) => b.value)
    .filter((v): v is number => v !== undefined && Number.isFinite(v));
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const integer = values.every(Number.isInteger);
  const ticks = niceTicks(min, max, 4, integer);
  const hi = ticks.at(-1)! >= max ? ticks.at(-1)! : max;
  // A negative value pulls the floor down to a tick below it; bars then grow from the zero line.
  let lo = 0;
  if (min < 0) {
    const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 1;
    lo = Math.floor(min / step) * step;
  }
  return {
    lo,
    hi,
    auto: true,
    ticks: niceTicks(lo, hi, 4, integer).length > 1 ? niceTicks(lo, hi, 4, integer) : [lo, hi],
  };
}

/**
 * Bars per step (squelch levels, S-meter steps, per-frequency offsets). `domain: 'auto'` scales to the data and says
 * so, so small offsets stay visible; an overlay read is drawn outlined beside each filled bar. Bar labels come from
 * the model; a bar with no value is drawn as a dash, never as zero.
 */
export default function StepBarChart({
  chart,
  overlay,
  readLabel,
  overlayLabel,
}: StepBarChartProps) {
  const scheme = useComputedColorScheme('light');
  const color = lineChartSlotColor(0, scheme);
  const { lo, hi, auto, ticks } = stepBarDomain(chart, overlay);
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n = Math.max(1, chart.bars.length);
  const slot = plotW / n;
  const barW = Math.max(1, overlay ? (slot - 4) / 2 : slot - 4);
  const sy = (v: number) =>
    M.top + plotH - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * plotH;
  const baseline = M.top + plotH;
  // Bars grow from the zero line (the floor when the domain does not span zero).
  const zeroY = sy(0);
  const stride = Math.max(1, Math.ceil(26 / slot));
  const unit = chart.y.unit;
  const who = (name?: string) => (name ? `${name}: ` : '');

  const bar = (
    value: number | undefined,
    x: number,
    label: string,
    hollow: boolean,
    key: string,
  ) =>
    value === undefined || !Number.isFinite(value) ? (
      <g key={key}>
        <title>{`${label}: Not captured`}</title>
        <line
          x1={x + 1}
          x2={x + Math.max(barW - 1, 2)}
          y1={baseline - 2}
          y2={baseline - 2}
          stroke="var(--mantine-color-dimmed)"
          strokeWidth={2}
        />
      </g>
    ) : (
      <rect
        key={key}
        x={x}
        y={Math.min(sy(value), zeroY)}
        width={barW}
        height={Math.max(1, Math.abs(zeroY - sy(value)))}
        rx={2}
        fill={hollow ? 'none' : color}
        stroke={color}
        strokeWidth={hollow ? 1.5 : 0}
      >
        <title>{`${label}: ${formatDecimal(value, unit)}`}</title>
      </rect>
    );

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={chart.title}
        style={{ display: 'block', maxWidth: W }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={sy(t)}
              y2={sy(t)}
              stroke="var(--mantine-color-default-border)"
            />
            <text
              x={M.left - 5}
              y={sy(t)}
              fontSize={11}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--mantine-color-dimmed)"
            >
              {t}
            </text>
          </g>
        ))}
        {chart.bars.map((b, i) => {
          const x0 = M.left + i * slot + 2;
          const o = overlay?.bars.find((ob) => ob.id === b.id);
          const base = `${who(overlay ? readLabel : undefined)}${b.label}`;
          return (
            <g key={b.id}>
              {bar(b.value, x0, base, false, `${b.id}-read`)}
              {overlay
                ? bar(
                    o?.value,
                    x0 + barW + 1,
                    `${who(overlayLabel ?? 'overlay')}${b.label}`,
                    true,
                    `${b.id}-overlay`,
                  )
                : null}
              {i % stride === 0 ? (
                <text
                  x={M.left + i * slot + slot / 2}
                  y={baseline + 13}
                  fontSize={11}
                  textAnchor="middle"
                  fill="var(--mantine-color-dimmed)"
                >
                  {b.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <text
          x={M.left + plotW / 2}
          y={H - 6}
          fontSize={12}
          textAnchor="middle"
          fill="var(--mantine-color-dimmed)"
        >
          {chart.x.label}
        </text>
        <text
          x={11}
          y={M.top + plotH / 2}
          fontSize={12}
          textAnchor="middle"
          fill="var(--mantine-color-dimmed)"
          transform={`rotate(-90 11 ${M.top + plotH / 2})`}
        >
          {axisTitle(chart.y.label, unit)}
        </text>
      </svg>
      {auto ? (
        <div style={{ fontSize: 11, color: 'var(--dsv2-text-tertiary)', marginTop: 2 }}>
          {`scale ${lo}–${hi}`}
        </div>
      ) : null}
    </div>
  );
}
