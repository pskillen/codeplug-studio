import type { RadioDebugCoverageView } from '../descriptors.ts';
import type { DebugArchive } from '../captureArchive.ts';
import { formatAddress } from '../viewerUtils.ts';
import { Text } from '@mantine/core';
import { MMD1_BASE, MMD1_END } from '@integrations/radio-io/radios/rt95/modData/layout.ts';
import { RT95_MMD1_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import { RT95_IMAGE_SIZE } from '@integrations/radio-io/radios/rt95/constants.ts';
import {
  RT95_CALIBRATION_START,
  RT95_CALIBRATION_LENGTH,
  RT95_SIGNATURE_START,
  RT95_SIGNATURE_END,
} from '@core/radios/retevis/rt95/calibration.ts';
import { RT95_CALIBRATION_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import { rt95ArchiveDetails } from '../captureArchive.ts';

/** RT95 Backup coverage: programming image gaps, main-body and MMD1 EEPROM captures. */
export function rt95Coverage(archive: DebugArchive): RadioDebugCoverageView | undefined {
  const rt95 = rt95ArchiveDetails(archive);
  if (!rt95) return undefined;
  return {
    summary: rt95.summary ? (
      <Text>
        Clone summary · {rt95.summary.occupiedChannelCount} occupied channels ·{' '}
        {rt95.summary.emptyChannelCount} empty channels
      </Text>
    ) : undefined,
    body: (
      <>
        {rt95.missing.map((gap) => (
          <Text key={gap.start}>
            RT95 programming image {formatAddress(gap.start)}–{formatAddress(gap.end)} · Missing
          </Text>
        ))}
        <Text>
          Clone programming-image offsets [unknown]: {formatAddress(0)}–
          {formatAddress(RT95_IMAGE_SIZE - 1)}.
        </Text>
        <Text>
          Main-body EEPROM via head [body]:{' '}
          {archive.regions[RT95_CALIBRATION_REGION_ID]?.length
            ? `captured ${formatAddress(RT95_CALIBRATION_START)}–${formatAddress(RT95_CALIBRATION_START + archive.regions[RT95_CALIBRATION_REGION_ID]!.length - 1)}`
            : 'Not captured'}
          .
        </Text>
        {(archive.regions[RT95_CALIBRATION_REGION_ID]?.length ?? 0) < RT95_CALIBRATION_LENGTH && (
          <Text>
            {formatAddress(
              RT95_CALIBRATION_START + (archive.regions[RT95_CALIBRATION_REGION_ID]?.length ?? 0),
            )}
            –{formatAddress(RT95_CALIBRATION_START + RT95_CALIBRATION_LENGTH - 1)} not captured.
          </Text>
        )}
        <Text>
          MMD1 EEPROM [body]: {archive.regions[RT95_MMD1_REGION_ID]?.length ?? 0} of{' '}
          {MMD1_END - MMD1_BASE} bytes captured ({formatAddress(MMD1_BASE)}–
          {formatAddress(MMD1_END - 1)}). The head can return checksum-valid zeros without a body
          reply; coverage remains partial.
        </Text>
        {(archive.regions[RT95_MMD1_REGION_ID]?.length ?? 0) < MMD1_END - MMD1_BASE && (
          <Text>
            MMD1 {formatAddress(MMD1_BASE + (archive.regions[RT95_MMD1_REGION_ID]?.length ?? 0))}–
            {formatAddress(MMD1_END - 1)} not captured.
          </Text>
        )}
        <Text>
          {formatAddress(RT95_IMAGE_SIZE)}–{formatAddress(RT95_CALIBRATION_START - 1)} not captured.{' '}
          {formatAddress(RT95_CALIBRATION_START + RT95_CALIBRATION_LENGTH)}–
          {formatAddress(RT95_SIGNATURE_START - 1)} is outside the calibration capture. Signature{' '}
          {formatAddress(RT95_SIGNATURE_START)}–{formatAddress(RT95_SIGNATURE_END)} is outside this
          capture. These are distinct representations, not a proven physical memory map.
        </Text>
      </>
    ),
  };
}
