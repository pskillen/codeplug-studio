/**
 * DM-32 calibration and factory-sector inspect on Backup / Restore.
 * Reads the zip sidecar and region bytes. Does not offer Restore for either.
 */

import { useMemo } from 'react';
import { Group, Stack, Table, Text } from '@mantine/core';
import { parseRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import {
  DM32_FACTORY_SECTOR_REGION_ID,
  type Dm32CalibrationBackupJson,
  type Dm32FactoryBackupJson,
  type Dm32HexRow,
} from '@integrations/radio-io/radios/dm32uv/calibrationDecode.ts';
import { FormSection } from '../../components/ui/index.ts';
import { downloadBlob } from '../../lib/downloadBlob.ts';
import type { RadioBackupSession } from '../../services/radioBackupRestore.ts';
import { Button } from '../../components/v2/index.ts';

function parseJson<T>(text: string | undefined): T | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return null;
    return value as T;
  } catch {
    return null;
  }
}

function hexAddress(address: number): string {
  return `0x${address.toString(16)}`;
}

function formatHz(hz: number | null): string {
  if (hz === null) return '—';
  return `${(hz / 1_000_000).toFixed(4)} MHz`;
}

function formatHzList(points: readonly (number | null)[]): string {
  return points.map((hz) => formatHz(hz)).join(', ');
}

function formatBytes(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

function HexRows({ rows }: { rows: readonly Dm32HexRow[] }) {
  if (rows.length === 0) return <Text size="sm">None</Text>;
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Offset</Table.Th>
          <Table.Th>Bytes</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row) => (
          <Table.Tr key={row.offset}>
            <Table.Td>
              <Text ff="monospace" size="sm">
                {hexAddress(row.offset)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text ff="monospace" size="sm">
                {row.hex}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function downloadBytes(bytes: Uint8Array, fileName: string): void {
  downloadBlob(new Blob([bytes.slice()]), fileName);
}

export default function Dm32CalibrationBackupPanel({ session }: { session: RadioBackupSession }) {
  const calibration = parseJson<Dm32CalibrationBackupJson>(session.dm32CalibrationJson);
  const factory = parseJson<Dm32FactoryBackupJson>(session.dm32FactoryJson);
  const regionBytes = useMemo(() => {
    try {
      return parseRadioBackupZip(session.zipBytes).regions;
    } catch {
      return {};
    }
  }, [session.zipBytes]);

  if (!calibration && !factory) return null;

  const liveRegion = session.manifest.regions.find(
    (region) => calibration?.liveAddress != null && region.address === calibration.liveAddress,
  );
  const liveBytes = liveRegion ? regionBytes[liveRegion.id] : undefined;
  const factoryBytes = regionBytes[DM32_FACTORY_SECTOR_REGION_ID];
  const decoded = calibration?.decoded ?? null;

  return (
    <Stack gap="lg">
      <FormSection title="Calibration">
        <Text size="sm">
          The calibration page moves. This backup records its address and tag. Vendor CPS can resend
          tag 0x02 when Write Adjust is ticked, and a codeplug from another radio can overwrite this
          radio&apos;s calibration. Factory reset (SK1+SK2, and only when Allow Reset is set) does
          not touch tag 0x02 on firmware 048. Keep a copy of the zip off this computer.
        </Text>
        <Text size="sm">Inspect only. Write and Restore do not send this page.</Text>
        {calibration?.liveAddress != null ? (
          <Text size="sm">
            Live address{' '}
            <Text span ff="monospace">
              {hexAddress(calibration.liveAddress)}
            </Text>
            {calibration.tag != null ? ` · tag ${hexAddress(calibration.tag)}` : ''}
            {calibration.sha256 ? ` · SHA-256 ${calibration.sha256}` : ''}
          </Text>
        ) : (
          <Text size="sm">No in-range calibration page was in this backup.</Text>
        )}
        {calibration && calibration.duplicateAddresses.length > 0 ? (
          <Text size="sm">
            The lower address is the live calibration page. Duplicate, not live:{' '}
            {calibration.duplicateAddresses.map((address) => hexAddress(address)).join(', ')}.
          </Text>
        ) : null}
        {calibration?.efuseUidHex ? (
          <Text size="sm">
            eFuse identity{' '}
            <Text span ff="monospace">
              {calibration.efuseUidHex}
            </Text>
            {calibration.efuseDerivedHex ? ` · derived ${calibration.efuseDerivedHex}` : ''}. This
            is not a serial.
          </Text>
        ) : null}
        {decoded ? (
          <Stack gap="xs">
            <Text size="sm">
              UHF band {formatHz(decoded.uhfBand.lowHz)} – {formatHz(decoded.uhfBand.highHz)}. VHF
              band {formatHz(decoded.vhfBand.lowHz)} – {formatHz(decoded.vhfBand.highHz)}.
            </Text>
            <Text size="sm">UHF RX points: {formatHzList(decoded.frequencyPointsHz.uhfRx)}</Text>
            <Text size="sm">UHF TX points: {formatHzList(decoded.frequencyPointsHz.uhfTx)}</Text>
            <Text size="sm">VHF RX points: {formatHzList(decoded.frequencyPointsHz.vhfRx)}</Text>
            <Text size="sm">VHF TX points: {formatHzList(decoded.frequencyPointsHz.vhfTx)}</Text>
            <Text size="sm">
              UHF power low {formatBytes(decoded.uhfPower.low)}, mid{' '}
              {formatBytes(decoded.uhfPower.mid)}, high {formatBytes(decoded.uhfPower.high)}
            </Text>
            <Text size="sm">
              VHF power low {formatBytes(decoded.vhfPower.low)}, mid{' '}
              {formatBytes(decoded.vhfPower.mid)}, high {formatBytes(decoded.vhfPower.high)}
            </Text>
            <Text size="sm">
              UHF levels{' '}
              {decoded.levels.uhf
                .map((pair) => `${formatBytes(pair.level1)} / ${formatBytes(pair.level9)}`)
                .join('; ')}
              . VHF levels{' '}
              {decoded.levels.vhf
                .map((pair) => `${formatBytes(pair.level1)} / ${formatBytes(pair.level9)}`)
                .join('; ')}
              . Airband {formatBytes(decoded.levels.airband.level1)} /{' '}
              {formatBytes(decoded.levels.airband.level9)}.
            </Text>
            <Text size="sm" fw={600}>
              Boot scalars
            </Text>
            <HexRows rows={decoded.bootScalars} />
            <Text size="sm" fw={600}>
              Unknown rows
            </Text>
            <HexRows rows={decoded.unknownRows} />
          </Stack>
        ) : null}
        <Group gap="sm">
          {liveBytes ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                downloadBytes(
                  liveBytes,
                  `dm32-calibration-${hexAddress(calibration?.liveAddress ?? 0)}.bin`,
                )
              }
            >
              Download calibration page
            </Button>
          ) : null}
          {session.dm32CalibrationJson ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                downloadBlob(
                  new Blob([session.dm32CalibrationJson ?? ''], { type: 'application/json' }),
                  'calibration.json',
                )
              }
            >
              Download calibration JSON
            </Button>
          ) : null}
        </Group>
      </FormSection>
      {factory ? (
        <FormSection title="Factory sector">
          <Text size="sm">Inspect only. This backup does not restore the factory sector.</Text>
          {factory.kept && factory.decoded ? (
            <Stack gap="xs">
              <Text size="sm">
                Address{' '}
                <Text span ff="monospace">
                  {hexAddress(factory.address ?? factory.decoded.address)}
                </Text>
                {factory.sha256 ? ` · SHA-256 ${factory.sha256}` : ''}
              </Text>
              <Text size="sm">
                TX region {hexAddress(factory.decoded.txRegion)}
                {factory.decoded.txRegionUnrestricted
                  ? ' (136–174 / 400–470 MHz)'
                  : ' (restricted)'}
                . Anti-clone key{' '}
                <Text span ff="monospace">
                  {factory.decoded.antiCloneKeyHex}
                </Text>
                . GPS option bit {factory.decoded.gpsEnabled ? 'set' : 'clear'}.
              </Text>
            </Stack>
          ) : (
            <Text size="sm">
              {factory.reason === 'mismatch'
                ? 'The two factory-sector reads did not match, so the sector was not kept.'
                : 'The factory sector was not kept.'}
            </Text>
          )}
          {factory.kept && factoryBytes ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadBytes(factoryBytes, 'dm32-factory-sector.bin')}
            >
              Download factory sector
            </Button>
          ) : null}
        </FormSection>
      ) : null}
    </Stack>
  );
}
