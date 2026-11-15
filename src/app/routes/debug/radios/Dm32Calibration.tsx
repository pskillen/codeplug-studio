import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { sha256Hex } from '@integrations/radio-io/radios/dm32uv/calibrationDecode.ts';
import {
  DM32_CALIBRATION_BASIS_FIRMWARE,
  describeDm32CalibrationPage,
  describeDm32FactorySector,
  readDm32SidecarClaims,
  selectDm32LiveCalibration,
  type Dm32CalibrationConfidence,
  type Dm32CalibrationRow,
} from '@integrations/radio-io/radios/dm32uv/calibrationFields.ts';
import { dm32DebugIdentity } from '@integrations/radio-io/radios/dm32uv/debugCoverage.ts';
import type { DebugArchive } from './captureArchive.ts';
import type { DebugCalibrationProps } from './descriptors.ts';
import {
  archiveKey,
  formatAddress,
  HEX_PAGE_BYTES,
  hexRows,
  isDm32ModelId,
} from './viewerUtils.ts';

const CONFIDENCE: Record<Dm32CalibrationConfidence, { label: string; color: string }> = {
  traced: { label: 'Traced', color: 'green' },
  'partially-traced': { label: 'Partly traced', color: 'yellow' },
  unknown: { label: 'Unknown', color: 'gray' },
};

const offsetText = (offset: number) => `+0x${offset.toString(16).toUpperCase().padStart(3, '0')}`;
const rawHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');

function ConfidenceBadge({ value, kind }: { value: Dm32CalibrationConfidence; kind: string }) {
  return (
    <Badge color={CONFIDENCE[value].color} variant="light" title={`${kind} confidence`}>
      {CONFIDENCE[value].label}
    </Badge>
  );
}

function RowTable({ title, rows }: { title: string; rows: Dm32CalibrationRow[] }) {
  return (
    <Table.ScrollContainer minWidth={900}>
      <Table striped fz="sm" aria-label={title}>
        <Table.Caption>{title}</Table.Caption>
        <Table.Thead>
          <Table.Tr>
            {[
              'Offset',
              'Bytes',
              'Field',
              'Raw hex',
              'Decoded',
              'Source (firmware)',
              'Layout',
              'Meaning',
            ].map((h) => (
              <Table.Th key={h}>{h}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td ff="monospace">{offsetText(row.offset)}</Table.Td>
              <Table.Td>{row.length}</Table.Td>
              <Table.Td>
                <Text size="sm">{row.label}</Text>
                <Text size="xs" c="dimmed">
                  {row.group}
                </Text>
              </Table.Td>
              <Table.Td ff="monospace">{rawHex(row.raw)}</Table.Td>
              <Table.Td>
                {row.decoded ?? (
                  <Text size="sm" c="dimmed">
                    Raw only
                  </Text>
                )}
                {row.reason && (
                  <Text size="xs" c="orange">
                    {row.reason}
                  </Text>
                )}
                {row.note && (
                  <Text size="xs" c="dimmed">
                    {row.note}
                  </Text>
                )}
              </Table.Td>
              <Table.Td ff="monospace">{row.source}</Table.Td>
              <Table.Td>
                <ConfidenceBadge value={row.layoutConfidence} kind="Layout" />
              </Table.Td>
              <Table.Td>
                <ConfidenceBadge value={row.meaningConfidence} kind="Meaning" />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

type HexSource = { id: string; label: string; address: number; bytes: Uint8Array };

function HexPager({ source }: { source: HexSource }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(source.bytes.length / HEX_PAGE_BYTES));
  return (
    <Stack gap="xs">
      <div style={{ overflowX: 'auto' }}>
        <pre aria-label="Hexadecimal bytes">
          {hexRows(source.bytes, source.address, page)
            .map((row) => `${formatAddress(row.address)}  ${row.hex.padEnd(47)}  ${row.ascii}`)
            .join('\n')}
        </pre>
      </div>
      <Group>
        <Button variant="default" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Text>
          Page {page + 1} of {pages}
        </Text>
        <Button variant="default" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </Group>
    </Stack>
  );
}

function useHashes(items: { id: string; bytes: Uint8Array }[]) {
  const [hashes, setHashes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    void Promise.all(
      items.map(async (item) => [item.id, await sha256Hex(item.bytes)] as const),
    ).then((entries) => {
      if (!cancelled) setHashes(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [items]);
  return hashes;
}

function crossCheck(
  claimed: string | null | undefined,
  computed: string | undefined,
  name: string,
) {
  if (claimed === undefined) return `${name} absent: nothing to cross-check`;
  if (!computed) return 'Checking…';
  return claimed === computed ? `Agrees with ${name}` : `Differs from ${name}`;
}

function Loaded({ archive }: { archive: DebugArchive }) {
  const dm32 = isDm32ModelId(archive.manifest.radioModelId);
  const selection = useMemo(
    () => (dm32 ? selectDm32LiveCalibration(archive) : undefined),
    [archive, dm32],
  );
  const identity = useMemo(
    () =>
      selection
        ? dm32DebugIdentity(archive.sidecars, selection.coverage.windowRegions, archive.regions)
        : undefined,
    [archive, selection],
  );
  const claims = useMemo(() => readDm32SidecarClaims(archive.sidecars), [archive]);
  const rows = useMemo(
    () =>
      selection?.page && selection.address !== undefined
        ? describeDm32CalibrationPage(selection.page, selection.address)
        : [],
    [selection],
  );
  const factoryRows = useMemo(
    () => (selection?.factory ? describeDm32FactorySector(selection.factory.bytes) : []),
    [selection],
  );
  const hashItems = useMemo(
    () => [
      ...(selection?.page ? [{ id: 'live', bytes: selection.page }] : []),
      ...(selection?.duplicates ?? []).map((d) => ({ id: `dup-${d.address}`, bytes: d.page })),
      ...(selection?.factory ? [{ id: 'factory', bytes: selection.factory.bytes }] : []),
    ],
    [selection],
  );
  const hashes = useHashes(hashItems);
  const hexSources = useMemo<HexSource[]>(
    () => [
      ...(selection?.page && selection.address !== undefined
        ? [
            {
              id: 'live',
              label: `Live calibration page · ${formatAddress(selection.address)}`,
              address: selection.address,
              bytes: selection.page,
            },
          ]
        : []),
      ...(selection?.duplicates ?? []).map((d) => ({
        id: `dup-${d.address}`,
        label: `Duplicate page · ${formatAddress(d.address)}`,
        address: d.address,
        bytes: d.page,
      })),
      ...(selection?.factory
        ? [
            {
              id: 'factory',
              label: `Factory sector · ${formatAddress(selection.factory.address)}`,
              address: selection.factory.address,
              bytes: selection.factory.bytes,
            },
          ]
        : []),
    ],
    [selection],
  );
  const [hexId, setHexId] = useState<string | null>(null);

  if (!dm32 || !selection || !identity)
    return (
      <Alert title="Wrong model" color="red">
        Archive model {archive.manifest.radioModelId} is not a DM-32UV capture, so no calibration is
        shown.
      </Alert>
    );

  const v01 = identity.baseFirmware;
  const v01Text = v01?.failed ? undefined : v01?.text;
  const { coverage } = selection;
  const hexSource = hexSources.find((s) => s.id === hexId) ?? hexSources[0];
  const sector = coverage.factory && selection.factory;
  const factoryNotKept = claims.factory && !claims.factory.kept ? claims.factory : undefined;

  return (
    <Stack>
      <Title order={3}>Calibration</Title>
      <Alert color="yellow" title="Not validated on hardware">
        <Text size="sm">
          Layout basis: stock {DM32_CALIBRATION_BASIS_FIRMWARE}, traced in firmware analysis only.
          Captured V01 base version:{' '}
          <Text span fw={600}>
            {v01Text ?? 'Not captured'}
          </Text>
          . Running firmware and mod: Unknown. Repeat reads and sidecar agreement are not
          validation.
        </Text>
        {v01Text !== undefined && v01Text.trim() !== DM32_CALIBRATION_BASIS_FIRMWARE && (
          <Text size="sm" fw={600} mt="xs">
            The captured base version differs from the layout basis, so these offsets may not apply
            to this radio.
          </Text>
        )}
      </Alert>

      <Card withBorder>
        <Title order={4}>Live calibration page</Title>
        {selection.page && selection.address !== undefined ? (
          <Stack gap="xs" mt="xs">
            <Text size="sm">
              Address{' '}
              <Text span ff="monospace">
                {formatAddress(selection.address)}
              </Text>{' '}
              · tag 0x02 · lowest in-window tag 0x02 page. The address moves whenever the radio
              saves calibration.
            </Text>
            <Text size="sm">
              SHA-256{' '}
              <Text span ff="monospace" style={{ wordBreak: 'break-all' }}>
                {hashes.live ?? 'computing…'}
              </Text>
            </Text>
            <Text size="sm" c="dimmed">
              {crossCheck(claims.calibration?.sha256, hashes.live, 'calibration.json')}. Values are
              decoded from the captured bytes, never from the sidecar.
            </Text>
          </Stack>
        ) : (
          <Alert title="Not captured" mt="xs">
            {coverage.window
              ? 'No page tagged 0x02 was captured inside the configuration window.'
              : 'The archive does not state a valid configuration window, so no calibration page can be selected.'}
          </Alert>
        )}
        {selection.duplicates.length > 0 && (
          <Stack gap={2} mt="sm">
            <Text size="sm" fw={600}>
              Duplicate tag 0x02 pages (not decoded)
            </Text>
            {selection.duplicates.map((d) => (
              <Text key={d.address} size="sm">
                <Text span ff="monospace">
                  {formatAddress(d.address)}
                </Text>{' '}
                · SHA-256{' '}
                <Text span ff="monospace" style={{ wordBreak: 'break-all' }}>
                  {hashes[`dup-${d.address}`] ?? 'computing…'}
                </Text>{' '}
                · raw hex below
              </Text>
            ))}
          </Stack>
        )}
      </Card>

      {rows.length > 0 && <RowTable title="Calibration page fields" rows={rows} />}
      {rows.length > 0 && (
        <Text size="xs" c="dimmed">
          Every other byte of the page, including +0x096 onward, is shown only in the raw hex view.
          Values carry no physical units, validity bands or health verdict.
        </Text>
      )}

      <Card withBorder>
        <Title order={4}>Factory sector</Title>
        {sector ? (
          <Stack gap="xs" mt="xs">
            <Text size="sm">
              Address{' '}
              <Text span ff="monospace">
                {formatAddress(sector.address)}
              </Text>{' '}
              · 4096 bytes · inspect only · SHA-256{' '}
              <Text span ff="monospace" style={{ wordBreak: 'break-all' }}>
                {hashes.factory ?? 'computing…'}
              </Text>
            </Text>
            <Text size="sm" c="dimmed">
              {crossCheck(claims.factory?.sha256, hashes.factory, 'factory-sector.json')}. The
              anti-clone key is not decoded here; it appears only in the raw hex view.
            </Text>
            <RowTable title="Factory sector fields" rows={factoryRows} />
          </Stack>
        ) : (
          <Alert title={factoryNotKept ? 'Not kept' : 'Not captured'} mt="xs">
            {factoryNotKept
              ? `Not kept (${factoryNotKept.reason === 'failed' ? 'a read failed' : factoryNotKept.reason === 'mismatch' ? 'two reads disagreed' : 'reason not recorded'}).`
              : 'Not captured'}
          </Alert>
        )}
        <Text size="sm" mt="sm">
          Chip UID, not a serial:{' '}
          <Text span ff="monospace" style={{ wordBreak: 'break-all' }}>
            {identity.chipUidHex ? `0x${identity.chipUidHex.toUpperCase()}` : 'Not captured'}
          </Text>
        </Text>
      </Card>

      {selection.refused.length > 0 && (
        <Card withBorder>
          <Title order={4}>Regions not used</Title>
          <Text size="sm" c="dimmed">
            These regions are never searched for calibration.
          </Text>
          {selection.refused.map(({ region, reason }, index) => (
            <Text key={`${region.id}-${index}`} size="sm">
              {region.label} ({region.id}, {formatAddress(region.address)}): {reason}
            </Text>
          ))}
        </Card>
      )}

      {hexSource && (
        <Card withBorder>
          <Title order={4}>Raw bytes</Title>
          <Select
            label="Raw bytes source"
            value={hexSource.id}
            data={hexSources.map((s) => ({ value: s.id, label: s.label }))}
            onChange={setHexId}
            allowDeselect={false}
          />
          <HexPager key={hexSource.id} source={hexSource} />
        </Card>
      )}
    </Stack>
  );
}

/** Read-only DM-32UV calibration viewer. Replacing the archive resets everything. */
export function Dm32Calibration({ archive }: DebugCalibrationProps) {
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Calibration</Title>
        <Alert title="Not captured">Open or read a capture to inspect its calibration.</Alert>
      </Stack>
    );
  return <Loaded key={archiveKey(archive)} archive={archive} />;
}
