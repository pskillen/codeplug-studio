import { Alert, Button, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useState } from 'react';
import {
  OPENGD77_CALIBRATION_LENGTH,
  type OpenGd77CalibrationRow,
} from '@core/radios/opengd77/calibration.ts';
import {
  OPENGD77_CALIBRATION_ADDRESS,
  selectOpenGd77Calibration,
  type OpenGd77CalibrationSelection,
} from '@integrations/radio-io/radios/opengd77/debugCalibration.ts';
import { openGd77DebugIdentity } from '@integrations/radio-io/radios/opengd77/debugCoverage.ts';
import type { DebugCalibrationProps } from './descriptors.ts';
import type { DebugArchive } from './captureArchive.ts';
import { archiveKey, formatAddress, HEX_PAGE_BYTES, hexRows } from './viewerUtils.ts';

const GROUPS = [
  'Reference',
  'Oscillator',
  'Power',
  'RX tuning',
  'Squelch',
  'CTCSS',
  'DCS',
  'Gains',
  'Frequency points',
] as const;

const hex = (n: number, width = 2) => n.toString(16).toUpperCase().padStart(width, '0');
const rawText = (raw: Uint8Array) => Array.from(raw, (b) => hex(b)).join(' ');
const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

type Ok = Extract<OpenGd77CalibrationSelection, { status: 'ok' }>;

/** Why the overlay shows nothing, or the rows it contributes. */
function overlayFor(
  primary: Ok,
  overlayArchive: DebugArchive | undefined,
): { rows: Map<string, OpenGd77CalibrationRow> } | { note: string } | undefined {
  if (!overlayArchive) return undefined;
  const other = selectOpenGd77Calibration(overlayArchive);
  if (other.status === 'not-captured') {
    return { note: 'The overlay read has no calibration working copy, so nothing is overlaid.' };
  }
  if (other.status === 'unavailable') {
    return { note: `The overlay read cannot be used: ${other.reason}.` };
  }
  if (other.model.modelId !== primary.model.modelId) {
    return {
      note: `The overlay read is for ${other.model.label}, not ${primary.model.label}, so nothing is overlaid.`,
    };
  }
  if (other.decode.markerPresent !== primary.decode.markerPresent) {
    return {
      note: 'The overlay read has a different local marker state, so nothing is overlaid.',
    };
  }
  return { rows: new Map(other.decode.rows.map((r) => [r.id, r])) };
}

function Body({
  archive,
  overlayArchive,
}: {
  archive: DebugArchive;
  overlayArchive?: DebugArchive;
}) {
  const [page, setPage] = useState(0);
  const selection = selectOpenGd77Calibration(archive);
  if (selection.status === 'not-captured') {
    return (
      <Alert title="Calibration not captured">
        This archive has no calibration working copy (a Backup read, or a debug read from before
        this capture). The Hex tab still shows every region it holds.
      </Alert>
    );
  }
  if (selection.status === 'unavailable') {
    return (
      <Alert color="yellow" title="Calibration unavailable">
        {selection.reason}. The Hex tab still shows the stored bytes.
      </Alert>
    );
  }
  const { decode, bytes, model } = selection;
  const identity = openGd77DebugIdentity(archive.sidecars);
  const revision = identity?.status === 'ok' ? identity.revision : 'unknown';
  const buildDate = identity?.status === 'ok' ? identity.buildDate : 'unknown';
  const overlay = overlayFor(selection, overlayArchive);
  const overlayRows = overlay && 'rows' in overlay ? overlay.rows : undefined;
  const pages = Math.ceil(bytes.length / HEX_PAGE_BYTES);

  return (
    <Stack>
      <Alert title="OpenGD77 working copy, not stock factory calibration">
        OpenGD77 working copy, not stock factory calibration. It is what the firmware serves from
        RAM, which on the DM-1701 tree is already scaled from the factory values at import.
      </Alert>
      <Alert color="yellow" title="Not validated on hardware">
        Not validated on hardware. Units and meanings come from reading the OpenGD77 source (the
        Unit and Used by columns say what each row was traced to), and nothing on this page says
        whether a value is good, bad or healthy.
      </Alert>
      {model.calibrationLowSlot === 'very-low' && (
        <Alert title="DM-1701: working copy is scaled">
          The DM-1701 working copy is scaled from the factory values at import (Low x1.00, Mid x0.85
          or x0.86, High x1.30 or x1.70, VHF or UHF), and the very-low power slot is synthesised by
          OpenGD77 from Low, so these power values are not the stock factory numbers.
        </Alert>
      )}
      <Text size="sm">
        Layout read from OpenGD77 firmware sources dated 2026-01-30 (DM-1701 family) and 2026-01-31
        (MD-9600). This radio reports revision {revision}, built {buildDate}, as reported; whether
        that build uses the same layout is unknown.
      </Text>
      <Text size="sm">
        {decode.markerPresent
          ? 'Local marker present at 0x1B0'
          : "Marker absent: this is not the layout the firmware's loader writes, so decoded values are not shown"}{' '}
        · {formatAddress(OPENGD77_CALIBRATION_ADDRESS)} · {OPENGD77_CALIBRATION_LENGTH} bytes ·{' '}
        {model.label}
      </Text>
      {overlay && 'note' in overlay && <Alert title="Overlay not shown">{overlay.note}</Alert>}
      {GROUPS.map((group) => {
        const rows = decode.rows.filter((row) => row.group === group);
        return (
          <Card withBorder key={group}>
            <Title order={4}>{group}</Title>
            <Table.ScrollContainer minWidth={720}>
              <Table striped fz="sm">
                <Table.Caption>{group}</Table.Caption>
                <Table.Thead>
                  <Table.Tr>
                    {[
                      'Field',
                      'Offset',
                      'Width',
                      'Raw',
                      'Decoded',
                      'Unit',
                      'Used by',
                      ...(overlayRows ? ['Overlay', 'Differs'] : []),
                      'Layout',
                      'Meaning',
                      'Note',
                    ].map((h) => (
                      <Table.Th key={h}>{h}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row) => {
                    const other = overlayRows?.get(row.id);
                    return (
                      <Table.Tr key={row.id} data-row-id={row.id}>
                        <Table.Td>
                          {row.band ? `${row.band} ` : ''}
                          {row.label}
                        </Table.Td>
                        <Table.Td>0x{hex(row.offset, 3)}</Table.Td>
                        <Table.Td>{row.length}</Table.Td>
                        <Table.Td ff="monospace">{rawText(row.raw)}</Table.Td>
                        <Table.Td>{row.decoded ?? 'Raw only'}</Table.Td>
                        <Table.Td>
                          <Text size="xs">{row.unit}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">
                            {row.hasReader ? row.consumer : 'not used by OpenGD77'}
                          </Text>
                          {!row.hasReader && <Text size="xs">{row.consumer}</Text>}
                        </Table.Td>
                        {overlayRows && (
                          <>
                            <Table.Td ff="monospace">{other ? rawText(other.raw) : '—'}</Table.Td>
                            <Table.Td>
                              {other ? (sameBytes(row.raw, other.raw) ? 'equal' : 'differs') : '—'}
                            </Table.Td>
                          </>
                        )}
                        <Table.Td>{row.layoutConfidence}</Table.Td>
                        <Table.Td>{row.meaningConfidence}</Table.Td>
                        <Table.Td>
                          <Text size="xs">
                            {[row.note, `Evidence: ${row.evidence}`].filter(Boolean).join(' ')}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        );
      })}
      <Card withBorder>
        <Title order={4}>Unknown bytes</Title>
        <Text size="sm">
          No OpenGD77 code reads these bytes. The stock firmware meaning is unknown.
        </Text>
        {decode.unknownRanges.map((range) => (
          <Text key={range.offset} size="xs" ff="monospace" style={{ overflowWrap: 'anywhere' }}>
            0x{hex(range.offset, 3)} · {range.length} bytes · {range.meaning} · {rawText(range.raw)}
          </Text>
        ))}
      </Card>
      <Card withBorder>
        <Group justify="space-between">
          <Title order={4}>Raw working copy</Title>
          <Group gap="xs">
            <Button
              size="xs"
              variant="default"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous page
            </Button>
            <Text size="sm">
              Page {page + 1} of {pages}
            </Text>
            <Button
              size="xs"
              variant="default"
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next page
            </Button>
          </Group>
        </Group>
        {hexRows(bytes, OPENGD77_CALIBRATION_ADDRESS, page).map((row) => (
          <Text key={row.address} size="xs" ff="monospace" style={{ overflowWrap: 'anywhere' }}>
            {formatAddress(row.address)} · {row.hex}
          </Text>
        ))}
      </Card>
    </Stack>
  );
}

/** Read-only OpenGD77 calibration working copy viewer; never opens a transport. */
export function OpenGd77Calibration({ archive, overlayArchive }: DebugCalibrationProps) {
  if (!archive) {
    return (
      <Alert title="No capture">Open or read a capture to view the calibration working copy.</Alert>
    );
  }
  return <Body key={archiveKey(archive)} archive={archive} overlayArchive={overlayArchive} />;
}
