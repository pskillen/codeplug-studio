import { RT95_MMD1_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import { RT95_IMAGE_SIZE } from '@integrations/radio-io/radios/rt95/constants.ts';
import {
  RT95_CALIBRATION_START,
  RT95_CALIBRATION_LENGTH,
  RT95_SIGNATURE_START,
  RT95_SIGNATURE_END,
} from '@core/radios/retevis/rt95/calibration.ts';
import { RT95_CALIBRATION_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import { AT_D890_VITAL_UNIT_BYTES } from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import {
  atD890VitalComparison,
  classifyAtD890DebugCoverage,
} from '@integrations/radio-io/radios/at-d890uv/debugCoverage.ts';
import {
  formatUv5rMiniSpanRange,
  hashUv5rMiniDebugSpans,
  UV5R_MINI_FULL_READ_SIZE,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { classifyDm32DebugCoverage } from '@integrations/radio-io/radios/dm32uv/debugCoverage.ts';
import { classifyDm32Metadata } from '@integrations/radio-io/radios/dm32uv/memory.ts';
import { Card, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import {
  archiveGaps,
  rt95ArchiveDetails,
  uv5rMiniArchiveDetails,
  type DebugArchive,
} from './captureArchive.ts';
import { formatAddress, regionIdentity } from './viewerUtils.ts';

function RegionHash({ bytes }: { bytes: Uint8Array }) {
  const [result, setResult] = useState<{ bytes: Uint8Array; hash: string }>();
  useEffect(() => {
    let active = true;
    if (!globalThis.crypto?.subtle) {
      queueMicrotask(() => {
        if (active) setResult({ bytes, hash: 'Unavailable' });
      });
      return () => {
        active = false;
      };
    }
    globalThis.crypto.subtle
      .digest('SHA-256', Uint8Array.from(bytes))
      .then((value) => {
        if (active)
          setResult({
            bytes,
            hash: Array.from(new Uint8Array(value), (byte) =>
              byte.toString(16).padStart(2, '0'),
            ).join(''),
          });
      })
      .catch(() => {
        if (active) setResult({ bytes, hash: 'Unavailable' });
      });
    return () => {
      active = false;
    };
  }, [bytes]);
  return (
    <Text size="xs" style={{ overflowWrap: 'anywhere' }}>
      SHA-256: {result?.bytes === bytes ? result.hash : 'Computing…'}
    </Text>
  );
}

export function Coverage({ archive }: { archive: DebugArchive }) {
  const d890 =
    archive.manifest.radioModelId === 'AT-D890UV'
      ? classifyAtD890DebugCoverage(archive.manifest.regions)
      : undefined;
  const dm32 =
    archive.manifest.radioModelId === 'DM-32UV'
      ? classifyDm32DebugCoverage(archive.manifest, archive.regions, archive.sidecars)
      : undefined;
  const rt95 = rt95ArchiveDetails(archive);
  const mini = uv5rMiniArchiveDetails(archive);
  const clone =
    mini && archive.regions.clone?.length === UV5R_MINI_FULL_READ_SIZE
      ? archive.regions.clone
      : undefined;
  const hex = (bytes: Uint8Array) =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Title order={4}>Coverage manifest</Title>
        <Text>
          Source: {archive.source === 'file' ? 'Local archive' : 'Live read'} · Captured:{' '}
          {archive.manifest.capturedAt}
        </Text>
        {rt95?.summary && (
          <Text>
            Clone summary · {rt95.summary.occupiedChannelCount} occupied channels ·{' '}
            {rt95.summary.emptyChannelCount} empty channels
          </Text>
        )}
        {archive.manifest.regions.map((region) => (
          <div key={region.id}>
            <Text fw={600}>
              {d890
                ? d890.vital.some((v) => v.region?.id === region.id)
                  ? 'Vital read · separate provenance'
                  : d890.outside.some((r) => r.id === region.id)
                    ? 'Out-of-map sparse read'
                    : d890.unclassified.some((r) => r.id === region.id)
                      ? 'Unclassified address space'
                      : 'D890 virtual map'
                : dm32
                  ? dm32.factory?.id === region.id
                    ? 'Factory sector · separate address space'
                    : dm32.windowRegions.some((r) => r.id === region.id)
                      ? 'Configuration window'
                      : `Unclassified address space · ${dm32.unclassified.find((u) => u.region.id === region.id)?.reason ?? 'unknown'}`
                  : (regionIdentity(archive, region.id)?.space ?? 'Unclassified address space')}
            </Text>
            <Text>
              {region.label} · {mini && region.id.startsWith('mem-') ? 'Packed offset' : 'Start'}{' '}
              {formatAddress(region.address)} · {region.byteLength} bytes · Captured
            </Text>
            <RegionHash bytes={archive.regions[region.id]!} />
          </div>
        ))}
        {d890 ? (
          <>
            <Text fw={600}>Virtual map · sparse configuration</Text>
            {d890.map.map((range) => (
              <Text key={range.start}>
                {formatAddress(range.start)}–{formatAddress(range.end - 1)} ·{' '}
                {range.captured ? 'Captured' : 'Not captured'}
              </Text>
            ))}
            <Text fw={600}>Expected configuration spans</Text>
            {d890.spans.map((range, i) => (
              <Text key={`${range.label}-${range.start}-${i}`}>
                {range.label} {formatAddress(range.start)}–{formatAddress(range.end - 1)} ·{' '}
                {range.captured ? 'Captured' : 'Not captured'}
              </Text>
            ))}
            <Text fw={600}>Vital reads · requested separately</Text>
            <Text size="sm">
              {atD890VitalComparison(archive.sidecars['debug/vital.json'])
                ? 'Archive metadata reports two matching reads.'
                : 'Two-read comparison is not established by archive metadata.'}
            </Text>
            {d890.vital.map(({ def, region }) => (
              <Text key={def.id}>
                {def.label} {formatAddress(def.address)}–
                {formatAddress(def.address + AT_D890_VITAL_UNIT_BYTES - 1)} ·{' '}
                {region ? 'Captured' : 'Not captured'}
                {def.asReturned ? ' · as returned; not an independent physical copy' : ''}
              </Text>
            ))}
            <Text size="sm">
              Vital reads may overlap configuration ranges and are reported separately. A successful
              live capture compares two reads; archive metadata records that claim. Firmware can
              divert vital reads; these are the bytes returned, not proof of physical storage.
            </Text>
            <Text size="sm">
              Sparse configuration omits occupancy-skipped records. Out-of-map and unclassified
              entries remain separate above.
            </Text>
          </>
        ) : dm32 ? (
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
        ) : mini ? (
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
        ) : rt95 ? (
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
            {(archive.regions[RT95_CALIBRATION_REGION_ID]?.length ?? 0) <
              RT95_CALIBRATION_LENGTH && (
              <Text>
                {formatAddress(
                  RT95_CALIBRATION_START +
                    (archive.regions[RT95_CALIBRATION_REGION_ID]?.length ?? 0),
                )}
                –{formatAddress(RT95_CALIBRATION_START + RT95_CALIBRATION_LENGTH - 1)} not captured.
              </Text>
            )}
            <Text>
              MMD1 EEPROM [body]: {archive.regions[RT95_MMD1_REGION_ID]?.length ?? 0} of 8192 bytes
              captured (0x4000–0x5FFF). The head can return checksum-valid zeros without a body
              reply; coverage remains partial.
            </Text>
            {(archive.regions[RT95_MMD1_REGION_ID]?.length ?? 0) < 8192 && (
              <Text>
                MMD1 {formatAddress(0x4000 + (archive.regions[RT95_MMD1_REGION_ID]?.length ?? 0))}–
                {formatAddress(0x5fff)} not captured.
              </Text>
            )}
            <Text>
              {formatAddress(RT95_IMAGE_SIZE)}–{formatAddress(RT95_CALIBRATION_START - 1)} not
              captured. {formatAddress(RT95_CALIBRATION_START + RT95_CALIBRATION_LENGTH)}–
              {formatAddress(RT95_SIGNATURE_START - 1)} is outside the calibration capture.
              Signature {formatAddress(RT95_SIGNATURE_START)}–{formatAddress(RT95_SIGNATURE_END)} is
              outside this capture. These are distinct representations, not a proven physical memory
              map.
            </Text>
          </>
        ) : (
          <Text>
            Expected map not yet defined. Address spaces and coverage outside listed regions are
            unknown.
          </Text>
        )}
        {!mini &&
          !d890 &&
          !dm32 &&
          !rt95 &&
          archiveGaps(archive.manifest.regions).map((gap) => (
            <Text key={gap.start} c="dimmed">
              {formatAddress(gap.start)}–{formatAddress(gap.end)} · Not listed (address space and
              status unknown)
            </Text>
          ))}
        <Text size="sm">Sidecars: {Object.keys(archive.sidecars).join(', ') || 'none'}</Text>
      </Stack>
    </Card>
  );
}
