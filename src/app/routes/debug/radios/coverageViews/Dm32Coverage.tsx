import type { RadioDebugCoverageView } from '../descriptors.ts';
import type { DebugArchive } from '../captureArchive.ts';
import { formatAddress } from '../viewerUtils.ts';
import { Text } from '@mantine/core';
import { classifyDm32DebugCoverage } from '@integrations/radio-io/radios/dm32uv/debugCoverage.ts';
import { classifyDm32Metadata } from '@integrations/radio-io/radios/dm32uv/memory.ts';

/** DM-32UV Backup coverage: the 4 KiB configuration-window blocks and the factory sector. */
export function dm32Coverage(archive: DebugArchive): RadioDebugCoverageView {
  const dm32 = classifyDm32DebugCoverage(archive.manifest, archive.regions, archive.sidecars);
  return {
    regionKind: (id) =>
      dm32.factory?.id === id
        ? 'Factory sector · separate address space'
        : dm32.windowRegions.some((r) => r.id === id)
          ? 'Configuration window'
          : `Unclassified address space · ${dm32.unclassified.find((u) => u.region.id === id)?.reason ?? 'unknown'}`,
    body: (
          <>
            <Text fw={600}>Configuration window · 4 KiB blocks</Text>
            {dm32.window ? (
              <>
                <Text size="sm">
                  {formatAddress(dm32.window.start)}–{formatAddress(dm32.windowLast!)} from the
                  archive&apos;s stated window ·{' '}
                  {dm32.blocks.filter((b) => b.status === 'captured').length} of{' '}
                  {dm32.blocks.length} blocks captured
                  {dm32.discoveryRecorded
                    ? ''
                    : ' · this archive does not record which blocks the radio reported'}
                </Text>
                {dm32.blocks.map((block) => (
                  <Text key={block.address} size="sm">
                    {formatAddress(block.address)} · {block.status}
                    {block.tag !== undefined &&
                      ` · tag 0x${block.tag.toString(16).toUpperCase().padStart(2, '0')} (${classifyDm32Metadata(block.tag)})`}
                    {block.calibration === 'live' && ' · live calibration page'}
                    {block.calibration === 'duplicate' && ' · duplicate calibration page, not live'}
                  </Text>
                ))}
              </>
            ) : (
              <Text size="sm">
                The archive does not state a valid configuration window; its entries stay
                unclassified.
              </Text>
            )}
            <Text fw={600}>Factory sector · program flash, separate address space</Text>
            <Text size="sm">
              {dm32.factory
                ? `${formatAddress(dm32.factory.address)}–${formatAddress(dm32.factory.address + dm32.factory.byteLength - 1)} · Captured (both reads matched)`
                : 'Not captured'}
            </Text>
            <Text size="sm">
              The capture reads only the blocks the product Read reads. Blocks the radio reported
              but that were not read, and blocks it did not report, are not captured. This is not a
              flash or firmware image; other address spaces are unknown.
            </Text>
          </>
    ),
  };
}
