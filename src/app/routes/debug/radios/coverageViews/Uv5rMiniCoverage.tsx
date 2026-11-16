import type { RadioDebugCoverageView, RadioDebugExtraHexRegion } from '../descriptors.ts';
import type { DebugArchive } from '../captureArchive.ts';
import { formatAddress } from '../viewerUtils.ts';
import { Text } from '@mantine/core';
import {
  formatUv5rMiniSpanRange,
  hashUv5rMiniDebugSpans,
  UV5R_MINI_FULL_READ_SIZE,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { uv5rMiniArchiveDetails } from '../captureArchive.ts';

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');

/** UV-5R Mini Backup coverage: decoded clone span hashes, wire replies and mapped ranges. */
export function uv5rMiniCoverage(archive: DebugArchive): RadioDebugCoverageView | undefined {
  const mini = uv5rMiniArchiveDetails(archive);
  if (!mini) return undefined;
  const clone =
    archive.regions.clone?.length === UV5R_MINI_FULL_READ_SIZE ? archive.regions.clone : undefined;
  return {
    startLabel: (id) => (id.startsWith('mem-') ? 'Packed offset' : 'Start'),
    body: (
          <>
            {clone && (
              <>
                <Text fw={600}>SHA-256 of decoded clone spans</Text>
                {hashUv5rMiniDebugSpans(clone).map(({ span, sha256 }) => (
                  <Text size="xs" key={span.id} style={{ overflowWrap: 'anywhere' }}>
                    {span.label} {formatUv5rMiniSpanRange(span)} · SHA-256 (decoded): {sha256}
                  </Text>
                ))}
                <Text size="sm">F reply (wire): {hex(archive.sidecars['debug/f.bin']!)}</Text>
                <Text size="sm">M reply (wire): {hex(archive.sidecars['debug/m.bin']!)}</Text>
              </>
            )}
            {mini.coverage.map((range) => (
              <Text key={`${range.label}-${range.start}`}>
                {range.label} {formatAddress(range.start)}–{formatAddress(range.end)} ·{' '}
                {range.captured ? 'Captured' : 'Missing from mapped regions'}
              </Text>
            ))}
            <Text>
              The 0xEFC0 frame is a virtual report opportunity, not proof of physical flash
              contents. Other address spaces and unclassified archive regions are unknown. Hashes
              above are of the named archive region bytes; Mini clone captures contain decoded
              bytes. Wire bytes and handshake replies are preserved as sidecars.
            </Text>
          </>
    ),
  };
}

/** The raw wire bytes of a Mini read, offered in the Hex viewer beside the decoded regions. */
export function uv5rMiniExtraHexRegions(archive: DebugArchive): RadioDebugExtraHexRegion[] {
  const bytes = archive.sidecars['debug/wire.bin'];
  return bytes ? [{ id: 'wire', label: 'Wire bytes as received', bytes }] : [];
}
