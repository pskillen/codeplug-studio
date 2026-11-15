import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import LineChart, { type LineChartSeries } from '@app/components/LineChart/LineChart.tsx';
import {
  atD890CalibrationCorrection,
  decodeAtD890Calibration,
  type AtD890CalAvailability,
  type AtD890CalConfidence,
  type AtD890CalScalar,
  type AtD890CalTable,
} from '@core/radios/anytone/at-d890uv/calibration.ts';
import {
  AT_D890_VITAL_UNIT_BYTES,
  AT_D890_VITAL_UNITS,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import type { DebugArchive } from './captureArchive.ts';
import { formatAddress, HEX_PAGE_BYTES, hexRows } from './viewerUtils.ts';

const TUNE_A = AT_D890_VITAL_UNITS.find((unit) => unit.id === 'tune-a')!;
const TUNE_B = AT_D890_VITAL_UNITS.find((unit) => unit.id === 'tune-b')!;

export type AtD890TuneSelection =
  | { status: 'not-captured'; aliasPresent: boolean }
  | { status: 'refused'; reason: string }
  | { status: 'ok'; address: number; bytes: Uint8Array };

/**
 * Pick the live tune unit only: AT-D890UV `vital-tune-a` at its requested address, inspect-only, with manifest length
 * equal to the stored bytes and within one unit. Never falls back to tune-b (it can alias LocalInfo) or to labels.
 */
export function selectAtD890TuneRegion(archive: DebugArchive | undefined): AtD890TuneSelection {
  if (!archive) return { status: 'not-captured', aliasPresent: false };
  if (archive.manifest.radioModelId !== 'AT-D890UV')
    return { status: 'refused', reason: 'Archive is not an AT-D890UV capture.' };
  const entries = archive.manifest.regions.filter((r) => r.id === `vital-${TUNE_A.id}`);
  const aliasPresent = archive.manifest.regions.some((r) => r.id === `vital-${TUNE_B.id}`);
  if (entries.length === 0) return { status: 'not-captured', aliasPresent };
  if (entries.length > 1)
    return { status: 'refused', reason: 'Archive lists the live tune unit more than once.' };
  const region = entries[0]!;
  const bytes = archive.regions[region.id];
  if (region.address !== TUNE_A.address)
    return {
      status: 'refused',
      reason: `Live tune unit is recorded at ${formatAddress(region.address)}, not the requested ${formatAddress(TUNE_A.address)}.`,
    };
  if (region.restoreRole !== 'inspect-only')
    return { status: 'refused', reason: 'Live tune unit is not marked inspect-only.' };
  if (!bytes || bytes.length !== region.byteLength)
    return { status: 'refused', reason: 'Manifest length does not match the stored tune bytes.' };
  if (region.byteLength > AT_D890_VITAL_UNIT_BYTES)
    return { status: 'refused', reason: 'Live tune unit is larger than one 256 KiB unit.' };
  return { status: 'ok', address: region.address, bytes };
}

const hex = (n: number, width = 2) => n.toString(16).toUpperCase().padStart(width, '0');
const offsetText = (n: number) => `+0x${hex(n, 3)}`;
const rawText = (raw: Uint8Array) => Array.from(raw, (b) => hex(b)).join(' ') || '—';
const AVAILABILITY: Record<AtD890CalAvailability, string> = {
  captured: 'Captured',
  partial: 'Partly captured',
  'not-captured': 'Not captured',
};
const CONFIDENCE: Record<AtD890CalConfidence, string> = {
  traced: 'traced',
  'partially-traced': 'partially traced',
  unknown: 'unknown',
};

function ScalarTable({ title, rows }: { title: string; rows: readonly AtD890CalScalar[] }) {
  return (
    <Card withBorder>
      <Title order={4}>{title}</Title>
      <Table.ScrollContainer minWidth={720}>
        <Table striped fz="sm">
          <Table.Caption>{title}</Table.Caption>
          <Table.Thead>
            <Table.Tr>
              {[
                'Field',
                'Offset',
                'Width · order',
                'Raw',
                'Decoded',
                'Availability',
                'Confidence',
                'Source',
              ].map((h) => (
                <Table.Th key={h}>{h}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.label}</Table.Td>
                <Table.Td>{offsetText(row.offset)}</Table.Td>
                <Table.Td>{row.width === 1 ? 'u8' : 'u16 · little-endian assumed'}</Table.Td>
                <Table.Td ff="monospace">{rawText(row.raw)}</Table.Td>
                <Table.Td>{row.value ?? 'Unavailable'}</Table.Td>
                <Table.Td>{AVAILABILITY[row.availability]}</Table.Td>
                <Table.Td>
                  Layout {CONFIDENCE[row.layout]} · meaning {CONFIDENCE[row.meaning]}
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{row.source.consumers.join(', ')}</Text>
                  <Text size="xs" c="dimmed">
                    {row.source.note}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

/** Contiguous captured runs only: a missing index ends a line, it is never bridged. */
function seriesFor(
  tables: readonly AtD890CalTable[],
  label: string,
  dashed = false,
): LineChartSeries[] {
  return tables.flatMap((t, slot) => {
    const runs: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    t.values.forEach((y, x) => {
      if (y === undefined) {
        if (run.length) runs.push(run);
        run = [];
      } else run.push({ x, y });
    });
    if (run.length) runs.push(run);
    const name =
      t.group === 'power' ? `Selection ${t.selection}` : `${t.path === 'main' ? 'Main' : 'Sub'}`;
    return runs.map((points, i) => ({
      id: `${label}-${t.id}-${i}`,
      label: `${label} · ${runs.length > 1 ? `${name} (indexes ${points[0]!.x}–${points.at(-1)!.x})` : name}`,
      dashed,
      slot,
      points,
    }));
  });
}

function TableGroup({
  title,
  tables,
  frequencyNote,
  overlayTables,
  primaryLabel,
  overlayLabel,
}: {
  title: string;
  tables: readonly AtD890CalTable[];
  frequencyNote: string;
  overlayTables: readonly AtD890CalTable[];
  primaryLabel: string;
  overlayLabel: string;
}) {
  const first = tables[0]!;
  const series = [
    ...seriesFor(tables, primaryLabel),
    ...seriesFor(overlayTables, overlayLabel, true),
  ];
  const length = first.length;
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group gap="xs">
          <Title order={4}>{title}</Title>
          <Badge variant="light" color="gray">
            layout {CONFIDENCE[first.layout]} · meaning {CONFIDENCE[first.meaning]}
          </Badge>
        </Group>
        <Text size="sm">
          {tables
            .map(
              (t) =>
                `${t.label}: ${offsetText(t.offset)}, ${t.length} bytes, ${AVAILABILITY[t.availability].toLowerCase()}`,
            )
            .join('; ')}
          . Unsigned bytes; reference index {first.referenceIndex}.
        </Text>
        <Text size="sm" c="dimmed">
          {frequencyNote} Index rule: {first.indexRule}. Sources:{' '}
          {first.source.consumers.join(', ')}. {first.source.note}
        </Text>
        {series.length ? (
          <>
            <LineChart
              title={`${title} raw entries by index`}
              series={series}
              xLabel="Table index"
              yLabel="Raw byte"
            />
            <Text size="xs" c="dimmed">
              Lines join neighbouring captured indexes as a visual guide only; the firmware looks up
              one discrete entry and does not interpolate. Missing indexes are left as gaps.
            </Text>
          </>
        ) : (
          <Alert title="Not captured">No entries of these tables were captured.</Alert>
        )}
        <details>
          <summary>
            <Text span size="sm">
              Numeric table
            </Text>
          </summary>
          <Table.ScrollContainer minWidth={480}>
            <Table striped fz="xs">
              <Table.Caption>
                {title}: raw entries and difference from the reference entry
              </Table.Caption>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Index</Table.Th>
                  {tables.map((t) => (
                    <Table.Th key={t.id}>
                      {t.group === 'power' ? `Sel ${t.selection}` : t.path} {offsetText(t.offset)} ·
                      raw / Δref
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Array.from({ length }, (_, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      {i}
                      {i === first.referenceIndex ? ' (ref)' : ''}
                    </Table.Td>
                    {tables.map((t) => {
                      const v = t.values[i];
                      const d = atD890CalibrationCorrection(t.values, i, t.referenceIndex);
                      return (
                        <Table.Td key={t.id}>
                          {v === undefined
                            ? 'Not captured'
                            : `0x${hex(v)} (${v}) / ${d === undefined ? 'unavailable' : d > 0 ? `+${d}` : d}`}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </details>
      </Stack>
    </Card>
  );
}

function RawTune({ bytes, address }: { bytes: Uint8Array; address: number }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(bytes.length / HEX_PAGE_BYTES));
  const current = Math.min(page, pages - 1);
  return (
    <Card withBorder>
      <Title order={4}>Raw tune bytes</Title>
      <Text size="sm">
        Partially decoded: every captured byte is listed, including the unknown ranges. Archive
        bytes as stored; addresses are the requested addresses.
      </Text>
      <div style={{ overflowX: 'auto' }}>
        <pre aria-label="Tune unit hexadecimal bytes">
          {hexRows(bytes, address, current)
            .map((row) => `${formatAddress(row.address)}  ${row.hex.padEnd(47)}  ${row.ascii}`)
            .join('\n')}
        </pre>
      </div>
      <Group>
        <Button variant="default" disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous
        </Button>
        <Text>
          Page {current + 1} of {pages}
        </Text>
        <Button
          variant="default"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </Button>
      </Group>
    </Card>
  );
}

/** Read-only AT-D890UV calibration viewer over the live tune unit of an opened or captured archive. */
export function AtD890Calibration({
  archive,
  overlayArchive,
}: {
  archive?: DebugArchive;
  overlayArchive?: DebugArchive;
}) {
  const selection = selectAtD890TuneRegion(archive);
  if (selection.status === 'refused')
    return (
      <Alert color="red" title="Calibration not decoded">
        {selection.reason} No other region is decoded in its place.
      </Alert>
    );
  if (selection.status === 'not-captured')
    return (
      <Alert title="Not captured">
        {archive
          ? `This archive has no live tune unit (${formatAddress(TUNE_A.address)}).`
          : 'Open or read a capture to view calibration.'}
        {selection.aliasPresent &&
          ' Calibration B (as returned) is present but is not used: the radio can answer that address with LocalInfo.'}
      </Alert>
    );
  const cal = decodeAtD890Calibration(selection.bytes);
  const overlaySelection = selectAtD890TuneRegion(overlayArchive);
  const overlayCal =
    overlaySelection.status === 'ok' ? decodeAtD890Calibration(overlaySelection.bytes) : undefined;
  const primaryLabel = `Selected · ${archive!.manifest.capturedAt}`;
  const overlayLabel = `Overlay · ${overlayArchive?.manifest.capturedAt ?? 'unknown time'}`;
  const byGroup = (g: AtD890CalScalar['group']) => cal.scalars.filter((s) => s.group === g);
  const tables = (group: AtD890CalTable['group'], band: AtD890CalTable['band']) =>
    cal.tables.filter((t) => t.group === group && t.band === band);
  const unknownCaptured = cal.unknown.filter((r) => r.availability !== 'not-captured');
  return (
    <Stack>
      <Title order={3}>Calibration</Title>
      <Card withBorder>
        <Group gap="xs">
          <Badge color="yellow">Not validated on hardware</Badge>
          <Badge variant="light" color="gray">
            V1.05 static trace
          </Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 3 }} mt="md">
          {[
            ['Region · requested address', `${TUNE_A.label} · ${formatAddress(selection.address)}`],
            [
              'Captured length',
              `${cal.capturedLength} of ${AT_D890_VITAL_UNIT_BYTES} bytes (${AVAILABILITY[cal.availability].toLowerCase()})`,
            ],
            ['Source', archive!.source === 'file' ? 'Local archive' : 'Live read'],
            ['Running firmware', 'Unknown'],
            ['Firmware mod', 'Unknown'],
            ['Byte order', 'Little-endian assumed for 16-bit fields; not established'],
          ].map(([label, value]) => (
            <div key={label}>
              <Text size="xs" c="dimmed">
                {label}
              </Text>
              <Text fw={600}>{value}</Text>
            </div>
          ))}
        </SimpleGrid>
        <Text size="sm" c="dimmed" mt="md">
          Field offsets and arithmetic come from a static trace of V1.05 firmware; the running
          firmware is not identified, so they may not apply. Firmware may divert the requested
          address. Agreement between repeated reads shows a stable read, not valid calibration. No
          physical units, limits or health verdicts are given.
        </Text>
      </Card>
      {overlayArchive && overlaySelection.status !== 'ok' && (
        <Alert title="Overlay unavailable">
          {overlaySelection.status === 'refused'
            ? overlaySelection.reason
            : 'The overlay has no live tune unit; tune B is never substituted.'}
        </Alert>
      )}
      <ScalarTable title="Oscillator trim" rows={byGroup('trim')} />
      <Text size="sm" c="dimmed">
        Trim is neutral at 2000; the factory editor allows 0–4000. Those editor bounds are evidence,
        not validated RF limits.
      </Text>
      <ScalarTable title="Power references" rows={byGroup('power-reference')} />
      <ScalarTable title="Squelch references" rows={byGroup('squelch')} />
      <ScalarTable title="Meter references" rows={byGroup('meter')} />
      <TableGroup
        title="UHF power tables"
        tables={tables('power', 'uhf')}
        overlayTables={
          overlayCal?.tables.filter((t) => t.group === 'power' && t.band === 'uhf') ?? []
        }
        primaryLabel={primaryLabel}
        overlayLabel={overlayLabel}
        frequencyNote="Index 0 corresponds to 400 MHz in 1 MHz steps; index 40 is 440 MHz."
      />
      <TableGroup
        title="VHF/220 power tables"
        tables={tables('power', 'vhf-220')}
        overlayTables={
          overlayCal?.tables.filter((t) => t.group === 'power' && t.band === 'vhf-220') ?? []
        }
        primaryLabel={primaryLabel}
        overlayLabel={overlayLabel}
        frequencyNote="Indexes 0–38 correspond to 136–174 MHz in 1 MHz steps; 220 MHz uses index 39 onward and forces selection 0; index 9 is 145 MHz."
      />
      <TableGroup
        title="UHF squelch flatness"
        tables={tables('flatness', 'uhf')}
        overlayTables={
          overlayCal?.tables.filter((t) => t.group === 'flatness' && t.band === 'uhf') ?? []
        }
        primaryLabel={primaryLabel}
        overlayLabel={overlayLabel}
        frequencyNote="Index 0 corresponds to 400 MHz in 5 MHz steps."
      />
      <TableGroup
        title="VHF/220 squelch flatness"
        tables={tables('flatness', 'vhf-220')}
        overlayTables={
          overlayCal?.tables.filter((t) => t.group === 'flatness' && t.band === 'vhf-220') ?? []
        }
        primaryLabel={primaryLabel}
        overlayLabel={overlayLabel}
        frequencyNote="Index 0 corresponds to 136 MHz in 2 MHz steps; 220 MHz uses index 20."
      />
      <Card withBorder>
        <Title order={4}>Unknown ranges</Title>
        <Text size="sm">
          {unknownCaptured.length} captured ranges are not decoded and shown only as raw bytes.
        </Text>
        <Table.ScrollContainer minWidth={420}>
          <Table fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Range</Table.Th>
                <Table.Th>Availability</Table.Th>
                <Table.Th>Notes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cal.unknown.map((r) => (
                <Table.Tr key={r.offset}>
                  <Table.Td>
                    {offsetText(r.offset)}–{offsetText(r.end - 1)}
                  </Table.Td>
                  <Table.Td>{AVAILABILITY[r.availability]}</Table.Td>
                  <Table.Td>
                    {r.notes.map((n) => `${offsetText(n.offset)}: ${n.note}`).join('; ') ||
                      'Unknown'}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <RawTune bytes={selection.bytes} address={selection.address} />
    </Stack>
  );
}
