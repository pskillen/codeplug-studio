import type { RadioDebugCoverageView } from '../descriptors.ts';
import type { DebugArchive } from '../captureArchive.ts';
import { formatAddress } from '../viewerUtils.ts';
import { Text } from '@mantine/core';
import {
  OPENGD77_SETTINGS_GAP_ADDRESS,
  OPENGD77_SETTINGS_GAP_LENGTH,
} from '@integrations/radio-io/radios/opengd77/constants.ts';
import { classifyOpenGd77DebugCoverage } from '@integrations/radio-io/radios/opengd77/debugCoverage.ts';

/** OpenGD77 Backup coverage: registered FLASH spans, the packed User Database, working copy. */
export function openGd77Coverage(archive: DebugArchive): RadioDebugCoverageView {
  const og77 = classifyOpenGd77DebugCoverage(archive.manifest, archive.regions, archive.sidecars);
  return {
    omitCaptured: true,
    regionKind: (id) =>
      og77.spans.some((span) => span.id === id && span.state !== 'missing')
        ? 'FLASH span · registered programming range'
        : og77.userDatabase.state === 'captured' && id === 'user-database'
          ? 'User Database · packed, not contiguous flash'
          : og77.calibration.state === 'captured' && id === 'calibration-working-copy'
            ? 'OpenGD77 working copy at 0x10000 · as returned, served from RAM, not a flash span'
            : `Unclassified address space · ${og77.unclassified.find((u) => u.id === id)?.reason ?? 'unknown'}`,
    body: (
      <>
        <Text fw={600}>Registered FLASH spans</Text>
        {og77.spans.map((span) => (
          <Text key={span.id} size="sm">
            {span.label} {formatAddress(span.start)}–{formatAddress(span.start + span.length - 1)} ·{' '}
            {span.state === 'captured' && 'Captured'}
            {span.state === 'partial' && `Partial · ${span.capturedBytes} of ${span.length} bytes`}
            {span.state === 'missing' && 'Missing from this archive'}
          </Text>
        ))}
        <Text fw={600}>Not read</Text>
        {og77.gaps.map((gap) => (
          <Text key={gap.start} size="sm">
            {formatAddress(gap.start)}–{formatAddress(gap.end - 1)} · Not read, unknown
          </Text>
        ))}
        <Text size="sm">
          Everything outside the spans above is not read and unknown, including stock factory
          calibration, EEPROM-class data and firmware.
        </Text>
        <Text fw={600}>User Database</Text>
        <Text size="sm">
          {og77.userDatabase.state === 'captured'
            ? `${og77.userDatabase.byteLength} bytes · ${og77.userDatabase.headerOnly ? 'Header only' : 'Header and entries'} · `
            : 'Not captured (read only when ticked before Read radio) · '}
          packed header + entries, not contiguous flash (segment 1 lives elsewhere in flash)
        </Text>
        <Text fw={600}>Calibration working copy</Text>
        <Text size="sm">
          {og77.calibration.state === 'captured'
            ? `${og77.calibration.byteLength} bytes · OpenGD77 working copy as returned at 0x10000, its own address space, not stock factory calibration`
            : 'Not captured'}
        </Text>
        <Text fw={600}>Settings struct tail</Text>
        <Text size="sm">
          {og77.settingsGap.state === 'captured'
            ? `${og77.settingsGap.byteLength} bytes · flash ${formatAddress(OPENGD77_SETTINGS_GAP_ADDRESS)}–${formatAddress(OPENGD77_SETTINGS_GAP_ADDRESS + OPENGD77_SETTINGS_GAP_LENGTH - 1)}, read so the settings struct is complete`
            : 'Not captured (older archive)'}
        </Text>
        {og77.unclassified.length > 0 && <Text fw={600}>Unclassified entries</Text>}
        {og77.unclassified.map((entry) => (
          <Text key={entry.id} size="sm">
            {entry.id} · {formatAddress(entry.address)} · {entry.byteLength} bytes · {entry.reason}
          </Text>
        ))}
        {og77.flashPart && <Text size="sm">{og77.flashPart}</Text>}
        <Text size="sm">
          This is a read of the registered programming spans and the occupied User Database, not a
          full flash image or a firmware dump.
        </Text>
      </>
    ),
  };
}
