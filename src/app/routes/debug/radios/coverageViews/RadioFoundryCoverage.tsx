import { Text } from '@mantine/core';
import { classifyRadioFoundryDebugCoverage } from '@integrations/radio-io/radios/radiofoundry/debugCoverage.ts';
import { RADIOFOUNDRY_REGION } from '@integrations/radio-io/radios/radiofoundry/debugCapture.ts';
import type { DebugArchive } from '../captureArchive.ts';
import type { RadioDebugCoverageView } from '../descriptors.ts';
import { formatAddress } from '../viewerUtils.ts';

/** RadioFoundry Backup coverage from SUMS rows and manifest regions. */
export function radioFoundryCoverage(archive: DebugArchive): RadioDebugCoverageView | undefined {
  const cov = classifyRadioFoundryDebugCoverage(
    archive.manifest,
    archive.regions,
    archive.sidecars,
  );
  if (!cov) return undefined;
  return {
    omitCaptured: true,
    regionKind: (id) => {
      if (id === RADIOFOUNDRY_REGION.eeprom) {
        return 'EEPROM image · served by the codeplug protocol';
      }
      if (id === RADIOFOUNDRY_REGION.flash) {
        return 'Flash image to the codeplug end · DMR ID database area 1 included';
      }
      if (id === RADIOFOUNDRY_REGION.area2) {
        return 'DMR ID database area 2 · read to the last non-blank block';
      }
      return undefined;
    },
    body: (
      <>
        {cov.regions.map((region) => (
          <Text key={region.id} size="sm">
            {region.label}: {region.blocksRead} blocks read · {region.blocksBlank} reported blank,
            not sent
          </Text>
        ))}
        <Text size="sm">
          {cov.area2.state === 'not-read'
            ? "Area 2: Not read (tick 'Also read the DMR ID database area 2')"
            : `Area 2: Read to ${formatAddress(cov.area2.readTo)}; ${cov.area2.blankAfter} blank blocks after it to ${formatAddress(cov.area2.imageEnd)}`}
        </Text>
        <Text size="sm">
          {formatAddress(cov.gap.start)}–{formatAddress(cov.gap.end - 1)}: calibration, settings
          ring and journal; the codeplug protocol never serves it
        </Text>
        {cov.sums === 'missing' && (
          <Text size="sm">Checksum list missing from this archive</Text>
        )}
      </>
    ),
  };
}