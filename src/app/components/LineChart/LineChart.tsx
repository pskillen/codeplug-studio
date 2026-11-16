import { Box, Group, Table, Text, useComputedColorScheme } from '@mantine/core';
import { useId, useMemo, useState, type MouseEvent } from 'react';

import { lineChartSlotColor, niceTicks, yAxisFor } from './lineChartScale.ts';

/** One line. `slot` is a categorical slot index (0-based) so the chart picks the light or dark step itself. */
export interface LineChartSeries {
  id: string;
  label: string;
  slot: number;
  dashed?: boolean;
  points: readonly { x: number; y: number }[];
}

export interface LineChartProps {
  /** Accessible name of the chart, also the table view's caption. */
  title: string;
  series: readonly LineChartSeries[];
  xLabel: string;
  yLabel: string;
  formatX?: (x: number) => string;
  formatY?: (y: number) => string;
  /** Fixed y range; by default the data's range, padded and rounded to nice ticks. */
  yDomain?: readonly [number, number];
  height?: number;
  /** Show the legend even for a single series. */
  showLegend?: boolean;
  /** Show the chart's own collapsed **Table** under it. Default `true`; a chart card turns it off. */
  table?: boolean;
}

/** Runs of consecutive points with a finite y: a non-finite y is a missing entry and leaves a gap. */
function finiteRuns(points: readonly { x: number; y: number }[]) {
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  for (const p of points) {
    if (Number.isFinite(p.y)) run.push(p);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

const WIDTH = 560;
const M = { top: 12, right: 16, bottom: 40, left: 48 };

/**
 * A small inline-SVG line chart: one axis pair, 2px lines (dashed for a second source), a legend above, a crosshair
 * with a tooltip of every series at the nearest x, and a table view under it. No dependency.
 */
export default function LineChart({
  title,
  series,
  xLabel,
  yLabel,
  formatX = String,
  formatY = String,
  yDomain,
  height = 240,
  showLegend = false,
  table = true,
}: LineChartProps) {
  const scheme = useComputedColorScheme('light');
  const clipId = useId();
  const [hoverX, setHoverX] = useState<number | null>(null);

  const xs = useMemo(
    () => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b),
    [series],
  );
  const ys = series.flatMap((s) => s.points.map((p) => p.y)).filter(Number.isFinite);
  const xMin = xs[0] ?? 0;
  const xMax = xs.at(-1) ?? 1;
  const { lo: yLo, hi: yHi, ticks: yTicks } = yAxisFor(ys, yDomain);
  const xTicks = niceTicks(xMin, xMax, 6).filter((t) => t >= xMin && t <= xMax);

  const plotW = WIDTH - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const sx = (x: number) => M.left + (xMax === xMin ? 0 : ((x - xMin) / (xMax - xMin)) * plotW);
  const sy = (y: number) => M.top + plotH - ((y - yLo) / (yHi - yLo)) * plotH;

  function onMove(e: MouseEvent<SVGRectElement>) {
    const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box || box.width === 0 || xs.length === 0) return;
    const px = ((e.clientX - box.left) / box.width) * WIDTH;
    let best = xs[0];
    for (const x of xs) if (Math.abs(sx(x) - px) < Math.abs(sx(best) - px)) best = x;
    setHoverX(best);
  }

  const ink = 'var(--mantine-color-text)';
  const muted = 'var(--mantine-color-dimmed)';
  const grid = 'var(--mantine-color-default-border)';
  const hoverRows =
    hoverX === null
      ? []
      : series
          .map((s) => ({ s, p: s.points.find((p) => p.x === hoverX) }))
          .filter((r) => r.p && Number.isFinite(r.p.y));

  return (
    <Box>
      {series.length > 1 || (showLegend && series.length > 0) ? (
        <Group gap="md" mb={4} aria-hidden>
          {series.map((s) => (
            <Group key={s.id} gap={6} wrap="nowrap">
              <svg width={20} height={8}>
                <line
                  x1={0}
                  x2={20}
                  y1={4}
                  y2={4}
                  stroke={lineChartSlotColor(s.slot, scheme)}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? '4 3' : undefined}
                />
              </svg>
              <Text size="xs">{s.label}</Text>
            </Group>
          ))}
        </Group>
      ) : null}
      <Box pos="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          width="100%"
          role="img"
          aria-label={title}
          style={{ display: 'block', maxWidth: WIDTH }}
        >
          <clipPath id={clipId}>
            <rect x={M.left} y={M.top - 2} width={plotW} height={plotH + 4} />
          </clipPath>
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={M.left} x2={M.left + plotW} y1={sy(t)} y2={sy(t)} stroke={grid} />
              <text
                x={M.left - 6}
                y={sy(t)}
                fontSize={12}
                fill={muted}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatY(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text
              key={`x${t}`}
              x={sx(t)}
              y={M.top + plotH + 16}
              fontSize={12}
              fill={muted}
              textAnchor="middle"
            >
              {formatX(t)}
            </text>
          ))}
          <text
            x={M.left + plotW / 2}
            y={height - 6}
            fontSize={12}
            fill={muted}
            textAnchor="middle"
          >
            {xLabel}
          </text>
          <text
            x={12}
            y={M.top + plotH / 2}
            fontSize={12}
            fill={muted}
            textAnchor="middle"
            transform={`rotate(-90 12 ${M.top + plotH / 2})`}
          >
            {yLabel}
          </text>
          <g clipPath={`url(#${clipId})`}>
            {series.map((s) =>
              finiteRuns(s.points).map((run, i) =>
                run.length === 1 ? (
                  <circle
                    key={`${s.id}-${i}`}
                    cx={sx(run[0].x)}
                    cy={sy(run[0].y)}
                    r={2.5}
                    fill={lineChartSlotColor(s.slot, scheme)}
                  />
                ) : (
                  <polyline
                    key={`${s.id}-${i}`}
                    fill="none"
                    stroke={lineChartSlotColor(s.slot, scheme)}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={s.dashed ? '6 4' : undefined}
                    points={run.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
                  />
                ),
              ),
            )}
          </g>
          {hoverX !== null ? (
            <g pointerEvents="none">
              <line x1={sx(hoverX)} x2={sx(hoverX)} y1={M.top} y2={M.top + plotH} stroke={muted} />
              {hoverRows.map(({ s, p }) => (
                <circle
                  key={s.id}
                  cx={sx(hoverX)}
                  cy={sy(p!.y)}
                  r={4}
                  fill={s.dashed ? 'var(--mantine-color-body)' : lineChartSlotColor(s.slot, scheme)}
                  stroke={lineChartSlotColor(s.slot, scheme)}
                  strokeWidth={2}
                />
              ))}
            </g>
          ) : null}
          <rect
            x={M.left}
            y={M.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHoverX(null)}
          />
        </svg>
        {hoverX !== null ? (
          <Box
            role="tooltip"
            pos="absolute"
            top={0}
            left={`${(sx(hoverX) / WIDTH) * 100}%`}
            px={8}
            py={4}
            style={{
              transform:
                sx(hoverX) > WIDTH / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
              background: 'var(--mantine-color-body)',
              border: `1px solid ${grid}`,
              borderRadius: 4,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Text size="xs" fw={600} c={ink}>
              {formatX(hoverX)}
            </Text>
            {hoverRows.map(({ s, p }) => (
              <Text key={s.id} size="xs">
                {s.label}: {formatY(p!.y)}
              </Text>
            ))}
          </Box>
        ) : null}
      </Box>
      {table ? (
        <details>
          <summary>
            <Text span size="xs" c="dimmed">
              Table
            </Text>
          </summary>
          <Table.ScrollContainer minWidth={320}>
            <Table striped withTableBorder fz="xs">
              <Table.Caption>{title}</Table.Caption>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{xLabel}</Table.Th>
                  {series.map((s) => (
                    <Table.Th key={s.id}>{s.label}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {xs.map((x) => (
                  <Table.Tr key={x}>
                    <Table.Td>{formatX(x)}</Table.Td>
                    {series.map((s) => {
                      const p = s.points.find((q) => q.x === x);
                      return (
                        <Table.Td key={s.id}>
                          {p && Number.isFinite(p.y) ? formatY(p.y) : ''}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </details>
      ) : null}
    </Box>
  );
}
