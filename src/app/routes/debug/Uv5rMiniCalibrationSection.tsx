import {
  Alert,
  Badge,
  Box,
  Code,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  useComputedColorScheme,
} from '@mantine/core';
import { useMemo, useState } from 'react';

import LineChart, { type LineChartSeries } from '@app/components/LineChart/LineChart.tsx';
import { lineChartSlotColor } from '@app/components/LineChart/lineChartScale.ts';
import { PageSection } from '@app/components/ui/index.ts';
import {
  decodeUv5rMiniCalibration,
  formatUv5rMiniSpanRange,
  UV5R_MINI_PA_LEVELS,
  UV5R_MINI_PA_ORDER,
  UV5R_MINI_PA_POINTS,
  UV5R_MINI_TRIM_MAX,
  UV5R_MINI_TRIM_SPAN_PPM,
  uv5rMiniTrimPpm,
  type Uv5rMiniCalibration,
  type Uv5rMiniCalibrationBytes,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';

import { formatHexByte as h2, formatHexAddress as addr, hexRows } from './uv5rMiniHexRows.ts';
import type { Uv5rMiniDebugRead } from './uv5rMiniDebugReads.ts';

const byteText = (n: number) => `0x${h2(n)} (${n})`;

function countDiffs(a: Uint8Array, b: Uint8Array | undefined): number {
  if (!b) return 0;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

function DiffBadge({ a, b }: { a: Uint8Array; b?: Uint8Array }) {
  if (!b) return null;
  const n = countDiffs(a, b);
  return n === 0 ? (
    <Badge color="green" variant="light">
      same in both
    </Badge>
  ) : (
    <Badge color="red" variant="light">
      {n} byte{n === 1 ? '' : 's'} differ
    </Badge>
  );
}

/** Bars of one 16-byte row, with the overlay read's bars beside them. */
function ByteBars({
  title,
  a,
  b,
  labels,
}: {
  title: string;
  a: Uint8Array;
  b?: Uint8Array;
  labels: [string, string?];
}) {
  const scheme = useComputedColorScheme('light');
  const W = 560;
  const H = 120;
  const left = 32;
  const plotW = W - left - 8;
  const plotH = H - 28;
  const slot = plotW / a.length;
  const barW = b ? (slot - 4) / 2 : slot - 4;
  const y = (v: number) => 8 + plotH - (v / 255) * plotH;
  const bar = (v: number, x: number, color: string, key: string, hollow: boolean) => (
    <rect
      key={key}
      x={x}
      y={y(v)}
      width={barW}
      height={Math.max(1, 8 + plotH - y(v))}
      rx={2}
      fill={hollow ? 'none' : color}
      stroke={color}
      strokeWidth={hollow ? 1.5 : 0}
    >
      <title>{`${key}: ${byteText(v)}`}</title>
    </rect>
  );
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={title}
      style={{ display: 'block', maxWidth: W }}
    >
      {[0, 128, 255].map((t) => (
        <g key={t}>
          <line
            x1={left}
            x2={W - 8}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--mantine-color-default-border)"
          />
          <text
            x={left - 4}
            y={y(t)}
            fontSize={10}
            textAnchor="end"
            dominantBaseline="middle"
            fill="var(--mantine-color-dimmed)"
          >
            {t}
          </text>
        </g>
      ))}
      {Array.from(a, (v, i) => {
        const x0 = left + i * slot + 2;
        return (
          <g key={i}>
            {bar(v, x0, lineChartSlotColor(0, scheme), `${labels[0]} byte ${i}`, false)}
            {b
              ? bar(
                  b[i],
                  x0 + barW + 1,
                  lineChartSlotColor(1, scheme),
                  `${labels[1]} byte ${i}`,
                  true,
                )
              : null}
            <text
              x={x0 + (slot - 4) / 2}
              y={H - 6}
              fontSize={10}
              textAnchor="middle"
              fill="var(--mantine-color-dimmed)"
            >
              {i}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** A centre-zero gauge of the trim in ppm (index 0–16, 8 = 0 ppm, 0.5 ppm a step). */
function TrimGauge({ a, b, labels }: { a: number; b?: number; labels: [string, string?] }) {
  const scheme = useComputedColorScheme('light');
  const W = 320;
  const x = (ppm: number) =>
    20 + ((ppm + UV5R_MINI_TRIM_SPAN_PPM) / (2 * UV5R_MINI_TRIM_SPAN_PPM)) * (W - 40);
  const marker = (ppm: number, color: string, hollow: boolean, label: string) =>
    Math.abs(ppm) <= UV5R_MINI_TRIM_SPAN_PPM ? (
      <circle
        cx={x(ppm)}
        cy={20}
        r={6}
        fill={hollow ? 'var(--mantine-color-body)' : color}
        stroke={color}
        strokeWidth={2}
      >
        <title>{label}</title>
      </circle>
    ) : null;
  const ticks = Array.from(
    { length: 2 * UV5R_MINI_TRIM_SPAN_PPM + 1 },
    (_, i) => i - UV5R_MINI_TRIM_SPAN_PPM,
  );
  return (
    <svg
      viewBox={`0 0 ${W} 50`}
      width="100%"
      role="img"
      aria-label="Frequency trim gauge"
      style={{ display: 'block', maxWidth: W }}
    >
      <line
        x1={x(-UV5R_MINI_TRIM_SPAN_PPM)}
        x2={x(UV5R_MINI_TRIM_SPAN_PPM)}
        y1={20}
        y2={20}
        stroke="var(--mantine-color-default-border)"
        strokeWidth={2}
      />
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={t === 0 ? 8 : 14}
            y2={t === 0 ? 32 : 26}
            stroke="var(--mantine-color-dimmed)"
          />
          <text
            x={x(t)}
            y={46}
            fontSize={10}
            textAnchor="middle"
            fill="var(--mantine-color-dimmed)"
          >
            {t > 0 ? `+${t}` : t}
          </text>
        </g>
      ))}
      {marker(uv5rMiniTrimPpm(a), lineChartSlotColor(0, scheme), false, labels[0])}
      {b === undefined
        ? null
        : marker(uv5rMiniTrimPpm(b), lineChartSlotColor(1, scheme), true, labels[1] ?? '')}
    </svg>
  );
}

function trimText(v: number): string {
  if (v > UV5R_MINI_TRIM_MAX) return `${byteText(v)}, above 16: the firmware uses index 8 (0 ppm)`;
  const ppm = uv5rMiniTrimPpm(v);
  return `${byteText(v)}, ${ppm > 0 ? '+' : ''}${ppm} ppm`;
}

function HexBlock({
  range,
  other,
  note,
}: {
  range: Uv5rMiniCalibrationBytes;
  other?: Uint8Array;
  note: string;
}) {
  return (
    <Stack gap={4}>
      <Group gap="xs">
        <Code>{formatUv5rMiniSpanRange(range)}</Code>
        <Text size="sm">{note}</Text>
        <DiffBadge a={range.bytes} b={other} />
      </Group>
      <Code block style={{ fontSize: 11 }}>
        {hexRows(range.start, range.bytes).join('\n')}
      </Code>
    </Stack>
  );
}

function readName(r: Uv5rMiniDebugRead): string {
  return `${r.label} (${r.readAt.toLocaleTimeString()})`;
}

/**
 * Read-only view of a read's calibration area (`0xF000–0xFFFF`), with an optional overlay of a second read. It only
 * shows bytes: nothing here exports, copies or sends them anywhere.
 */
export default function Uv5rMiniCalibrationSection({
  reads,
}: {
  reads: readonly Uv5rMiniDebugRead[];
}) {
  const [pickLabel, setPickLabel] = useState<string | null>(null);
  const [overlayLabel, setOverlayLabel] = useState<string | null>(null);
  const pick = pickLabel ?? reads.at(-1)?.label ?? null;
  const read = reads.find((r) => r.label === pick);
  const overlay = reads.find((r) => r.label === overlayLabel && r.label !== pick);

  const cal = useMemo(() => (read ? decodeUv5rMiniCalibration(read.decoded) : null), [read]);
  const other = useMemo<Uv5rMiniCalibration | null>(
    () => (overlay ? decodeUv5rMiniCalibration(overlay.decoded) : null),
    [overlay],
  );
  const options = reads.map((r) => ({ value: r.label, label: readName(r) }));

  return (
    <PageSection
      title="Calibration"
      description="0xF000–0xFFFF of one read, as shape: PA bias charts, the traced fields, hex for the rest. View only."
    >
      {!read || !cal ? (
        <Text size="sm" c="dimmed">
          Take a read to view its calibration.
        </Text>
      ) : (
        <Stack gap="lg" data-testid="uv5r-mini-calibration">
          <Group grow>
            <Select label="Read" data={options} value={pick} onChange={setPickLabel} />
            <Select
              label="Overlay (optional)"
              placeholder="None"
              clearable
              data={options.filter((o) => o.value !== pick)}
              value={overlay ? overlay.label : null}
              onChange={setOverlayLabel}
            />
          </Group>
          {cal.blank ? (
            <Alert color="yellow" title="Calibration reads as erased">
              0xF000 reads 0xFF in read {read.label}: the firmware treats calibration as absent.
            </Alert>
          ) : null}

          <Stack gap="xs">
            <Title order={4}>PA bias</Title>
            <Text size="sm" c="dimmed">
              0xF000–0xF0BF: 4 frequency segments × {UV5R_MINI_PA_LEVELS} power levels ×{' '}
              {UV5R_MINI_PA_POINTS} points, one byte each. Row order assumed: {UV5R_MINI_PA_ORDER}{' '}
              (row = segment × 3 + power level).
              {overlay ? ` Read ${read.label} solid, read ${overlay.label} dashed.` : ''}
            </Text>
            <SimpleGrid cols={{ base: 1, lg: 2 }}>
              {cal.paBias.map((seg, si) => {
                const first = seg.levels[0].points[0];
                const last = seg.levels.at(-1)!.points.at(-1)!;
                const lo = seg.segment.baseMhz;
                const hi = first.mhz + seg.segment.stepMhz * (UV5R_MINI_PA_POINTS - 1);
                const series: LineChartSeries[] = [];
                for (const line of seg.levels) {
                  series.push({
                    id: `a${line.level}`,
                    label: `Level ${line.level}${overlay ? ` (${read.label})` : ''}`,
                    slot: line.level,
                    points: line.points.map((p) => ({ x: p.mhz, y: p.value })),
                  });
                }
                if (other) {
                  for (const line of other.paBias[si].levels) {
                    series.push({
                      id: `b${line.level}`,
                      label: `Level ${line.level} (${overlay!.label})`,
                      slot: line.level,
                      dashed: true,
                      points: line.points.map((p) => ({ x: p.mhz, y: p.value })),
                    });
                  }
                }
                const title = `Segment ${si + 1}: ${lo}–${hi} MHz (${addr(first.address)}–${addr(last.address)})`;
                return (
                  <Stack key={si} gap={4}>
                    <Text size="sm" fw={600}>
                      {title}
                    </Text>
                    <LineChart
                      title={`PA bias, ${title}`}
                      series={series}
                      xLabel="MHz"
                      yLabel="Byte"
                      formatY={(v) => String(Math.round(v))}
                    />
                  </Stack>
                );
              })}
            </SimpleGrid>
          </Stack>

          <Stack gap="xs">
            <Group gap="xs">
              <Title order={4}>Squelch rows</Title>
              <Badge variant="light" color="gray">
                partly traced
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              One byte per frequency segment, by index.
              {overlay ? ` Read ${read.label} filled, read ${overlay.label} outlined.` : ''}
            </Text>
            {cal.squelch.map((row, i) => (
              <Stack key={row.id} gap={2}>
                <Group gap="xs">
                  <Code>{formatUv5rMiniSpanRange(row)}</Code>
                  <DiffBadge a={row.bytes} b={other?.squelch[i].bytes} />
                </Group>
                <ByteBars
                  title={`Squelch row ${formatUv5rMiniSpanRange(row)}`}
                  a={row.bytes}
                  b={other?.squelch[i].bytes}
                  labels={[read.label, overlay?.label]}
                />
              </Stack>
            ))}
          </Stack>

          <Stack gap="xs">
            <Group gap="xs">
              <Title order={4}>Battery thresholds</Title>
              <Code>0xF200–0xF205</Code>
            </Group>
            <BatteryLadder cal={cal} other={other} labels={[read.label, overlay?.label]} />
          </Stack>

          <Stack gap="xs">
            <Title order={4}>Single values</Title>
            <Table.ScrollContainer minWidth={420}>
              <Table striped fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Address</Table.Th>
                    <Table.Th>Field</Table.Th>
                    <Table.Th>{read.label}</Table.Th>
                    {overlay ? <Table.Th>{overlay.label}</Table.Th> : null}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[...cal.values, cal.region].map((v, i) => {
                    const o = other ? [...other.values, other.region][i] : undefined;
                    const filter = v.id.startsWith('filter');
                    const show = (n: number) =>
                      filter ? `${byteText(n)}, set ${n & 7}` : byteText(n);
                    return (
                      <Table.Tr key={v.id}>
                        <Table.Td>
                          <Code>{addr(v.address)}</Code>
                        </Table.Td>
                        <Table.Td>{v.label}</Table.Td>
                        <Table.Td>{show(v.value)}</Table.Td>
                        {o ? (
                          <Table.Td c={o.value === v.value ? undefined : 'red'}>
                            {show(o.value)}
                          </Table.Td>
                        ) : null}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>

          <Stack gap="xs">
            <Group gap="xs">
              <Title order={4}>Frequency trim</Title>
              <Code>{addr(cal.trim.address)}</Code>
            </Group>
            <Text size="sm">
              {read.label}: {trimText(cal.trim.value)}
              {other && overlay ? ` · ${overlay.label}: ${trimText(other.trim.value)}` : ''}
            </Text>
            <Box maw={320}>
              <TrimGauge
                a={cal.trim.value}
                b={other?.trim.value}
                labels={[read.label, overlay?.label]}
              />
            </Box>
            <Text size="xs" c="dimmed">
              ±4 ppm. The byte is an index 0–16: 8 is 0 ppm, each step 0.5 ppm. Above 16 the
              firmware uses index 8.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Title order={4}>Text</Title>
            {cal.texts.map((t, i) => (
              <Stack key={t.id} gap={2}>
                <Group gap="xs">
                  <Code>{formatUv5rMiniSpanRange(t)}</Code>
                  <Text size="sm">{t.label}</Text>
                  <DiffBadge a={t.bytes} b={other?.texts[i].bytes} />
                </Group>
                <Code block style={{ fontSize: 11 }}>
                  {`${read.label}  ${t.ascii}\n    ${Array.from(t.bytes, h2).join(' ')}`}
                  {other && overlay
                    ? `\n${overlay.label}  ${other.texts[i].ascii}\n    ${Array.from(other.texts[i].bytes, h2).join(' ')}`
                    : ''}
                </Code>
              </Stack>
            ))}
          </Stack>

          <Stack gap="xs">
            <Title order={4}>Hex: partly traced and untraced</Title>
            <Text size="sm" c="dimmed">
              Read {read.label}. Runs of one byte value collapse to a line.
            </Text>
            {cal.hex.map((range, i) => (
              <HexBlock
                key={range.id}
                range={range}
                other={other?.hex[i].bytes}
                note={range.kind === 'partlyTraced' ? 'partly traced' : 'untraced'}
              />
            ))}
          </Stack>
        </Stack>
      )}
    </PageSection>
  );
}

function BatteryLadder({
  cal,
  other,
  labels,
}: {
  cal: Uv5rMiniCalibration;
  other: Uv5rMiniCalibration | null;
  labels: [string, string?];
}) {
  const scheme = useComputedColorScheme('light');
  const column = (c: Uv5rMiniCalibration, label: string, slot: number) => (
    <Stack gap={4} miw={200} style={{ flex: 1 }}>
      <Group gap="xs">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        {c.blank ? (
          <Badge variant="light" color="gray">
            built-in defaults
          </Badge>
        ) : null}
      </Group>
      {c.battery.blank ? (
        <Text size="sm" c="dimmed">
          All six read 0xFF (blank).
          {c.blank ? ' 0xF000 reads as erased, so the firmware uses its built-in thresholds.' : ''}
        </Text>
      ) : (
        [...c.battery.values].reverse().map((v, ri) => {
          const step = c.battery.values.length - ri;
          return (
            <Group key={step} gap="xs" wrap="nowrap">
              <Text size="xs" w={48} c="dimmed">
                Step {step}
              </Text>
              <Box
                h={10}
                w={Math.max(2, Math.round((v / 255) * 160))}
                style={{ background: lineChartSlotColor(slot, scheme), borderRadius: 2 }}
              />
              <Text size="xs">{byteText(v)}</Text>
            </Group>
          );
        })
      )}
    </Stack>
  );
  return (
    <Group align="flex-start">
      {column(cal, labels[0], 0)}
      {other ? column(other, labels[1] ?? '', 1) : null}
    </Group>
  );
}
