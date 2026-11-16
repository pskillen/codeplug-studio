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
  uv5rMiniRegionTable,
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
  preferredLive,
}: {
  reads: readonly Uv5rMiniDebugRead[];
  preferredLive?: string | null;
}) {
  const [selection, setSelection] = useState<{
    label: string | null;
    preferredLive?: string | null;
  }>();
  const [overlayLabel, setOverlayLabel] = useState<string | null>(null);
  const pick =
    (selection?.preferredLive === preferredLive ? selection?.label : preferredLive) ??
    reads.at(-1)?.label ??
    null;
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
      description="0xF000–0xFFFF of one read, as shape: PA bias charts, squelch, the traced fields, hex for residue and the erased tail. View only."
    >
      {!read || !cal ? (
        <Text size="sm" c="dimmed">
          Take a read to view its calibration.
        </Text>
      ) : (
        <Stack gap="lg" data-testid="uv5r-mini-calibration">
          <Group grow>
            <Select
              label="Read"
              data={options}
              value={pick}
              onChange={(label) => setSelection({ label, preferredLive })}
            />
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
            <Group gap="xs">
              <Title order={4}>PA bias</Title>
              <Badge variant="light" color="gray">
                traced
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              0xF000–0xF0BF: {UV5R_MINI_PA_LEVELS} frames by power index (0xF000 High, 0xF040 level
              2, 0xF080 Low), each four rows of {UV5R_MINI_PA_POINTS} bytes in band order: UHF, VHF,
              200, 350 MHz. Row order: {UV5R_MINI_PA_ORDER}. The power index is the VFO frame&apos;s
              power byte; level 2 has no menu entry (its name is inferred). Only the points the
              firmware reads are plotted; the rest of each row has no reader.
              {overlay ? ` Read ${read.label} solid, read ${overlay.label} dashed.` : ''}
            </Text>
            <SimpleGrid cols={{ base: 1, lg: 2 }}>
              {cal.paBias.map((seg, si) => {
                const used = seg.segment.usedPoints;
                const first = seg.levels[0].points[0];
                const lo = seg.segment.baseMhz;
                const hi = lo + seg.segment.stepMhz * (used - 1);
                const series: LineChartSeries[] = [];
                for (const line of seg.levels) {
                  series.push({
                    id: `a${line.level}`,
                    label: `${line.name}${overlay ? ` (${read.label})` : ''}`,
                    slot: line.level,
                    points: line.points
                      .filter((p) => p.used)
                      .map((p) => ({ x: p.mhz, y: p.value })),
                  });
                }
                if (other) {
                  for (const line of other.paBias[si].levels) {
                    series.push({
                      id: `b${line.level}`,
                      label: `${line.name} (${overlay!.label})`,
                      slot: line.level,
                      dashed: true,
                      points: line.points
                        .filter((p) => p.used)
                        .map((p) => ({ x: p.mhz, y: p.value })),
                    });
                  }
                }
                const rowOffset = seg.segment.index * UV5R_MINI_PA_POINTS;
                const title = `${seg.segment.label}: ${lo}–${hi} MHz (row +0x${rowOffset.toString(16).toUpperCase().padStart(2, '0')} of each frame, from ${addr(first.address)})`;
                return (
                  <Stack key={si} gap={4}>
                    <Text size="sm" fw={600}>
                      {title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Point i = {lo} + {seg.segment.stepMhz} × i MHz; index {seg.segment.indexRule};{' '}
                      {used} points used.
                      {seg.segment.calibrated
                        ? ''
                        : ' Not calibrated: all zero on the radios read, so the firmware falls back to 0x007F.'}
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
              <Title order={4}>Squelch</Title>
              <Badge variant="light" color="gray">
                traced
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              0xF0C0–0xF11C. Open and close thresholds by level 0–9 (RSSI counts); the per-frequency
              offsets are subtracted from them.
              {overlay ? ` Read ${read.label} filled, read ${overlay.label} outlined.` : ''}
            </Text>
            {[...cal.squelch.thresholds, ...cal.squelch.offsets].map((row, i) => {
              const o = other
                ? [...other.squelch.thresholds, ...other.squelch.offsets][i]
                : undefined;
              return (
                <Stack key={row.id} gap={2}>
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      {row.label}
                    </Text>
                    <Code>{formatUv5rMiniSpanRange(row)}</Code>
                    <DiffBadge a={row.bytes} b={o?.bytes} />
                  </Group>
                  <Text size="xs" c="dimmed">
                    {row.note}
                    {row.used < row.bytes.length
                      ? `. Only the first ${row.used} bytes are read.`
                      : ''}
                  </Text>
                  <ByteBars
                    title={`${row.label} ${formatUv5rMiniSpanRange(row)}`}
                    a={row.bytes.subarray(0, row.used)}
                    b={o?.bytes.subarray(0, row.used)}
                    labels={[read.label, overlay?.label]}
                  />
                </Stack>
              );
            })}
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
                      filter
                        ? `${byteText(n)}, set ${n & 7}`
                        : v.id === 'mic'
                          ? `${byteText(n)}, low 6 bits ${n & 0x3f} (v0.04), low 5 bits ${n & 0x1f} (v0.27)`
                          : v.id === 'region'
                            ? `${byteText(n)}, band-edge table ${uv5rMiniRegionTable(n)}`
                            : byteText(n);
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
            <Group gap="xs">
              <Title order={4}>Band limits</Title>
              <Code>{formatUv5rMiniSpanRange(cal.bandLimits)}</Code>
              <Badge variant="light" color="gray">
                traced
              </Badge>
              <DiffBadge a={cal.bandLimits.bytes} b={other?.bandLimits.bytes} />
            </Group>
            <Text size="sm" c="dimmed">
              Four (low, high) MHz pairs, each two BCD bytes. The firmware does not use these: it
              takes its RX band edges from the region byte (0xF255). Only the clone F reply sends
              them. Bytes 0, 5, 10, 15 and 16 are never sent or read (unused, no reader).
            </Text>
            <Table fz="sm" striped w="fit-content">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Address</Table.Th>
                  <Table.Th>Low</Table.Th>
                  <Table.Th>High</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cal.bandLimits.bands.map((band) => (
                  <Table.Tr key={band.index}>
                    <Table.Td>
                      <Code>{addr(band.address)}</Code>
                    </Table.Td>
                    <Table.Td>{band.lowMhz === null ? 'not BCD' : `${band.lowMhz} MHz`}</Table.Td>
                    <Table.Td>{band.highMhz === null ? 'not BCD' : `${band.highMhz} MHz`}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
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
            <Title order={4}>Hex: frame residue and erased</Title>
            <Text size="sm" c="dimmed">
              Read {read.label}. Nothing here is free space: residue is copies left by the PC tool
              writing whole 64-byte frames (no reader in the firmware; cause inferred), and the rest
              is the erased calibration sector. A write at 0xF000 erases all of it. Runs of one byte
              value collapse to a line.
            </Text>
            {cal.hex.map((range, i) => (
              <HexBlock
                key={range.id}
                range={range}
                other={other?.hex[i].bytes}
                note={
                  range.kind === 'residue'
                    ? 'frame residue (no reader)'
                    : 'erased, unused (never read or written by the firmware)'
                }
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
