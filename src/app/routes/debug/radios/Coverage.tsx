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
  const rt95 = rt95ArchiveDetails(archive);
  const mini = uv5rMiniArchiveDetails(archive);
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
              {regionIdentity(archive, region.id)?.space ?? 'Unclassified address space'}
            </Text>
            <Text>
              {region.label} · {mini && region.id.startsWith('mem-') ? 'Packed offset' : 'Start'}{' '}
              {formatAddress(region.address)} · {region.byteLength} bytes · Captured
            </Text>
            <RegionHash bytes={archive.regions[region.id]!} />
          </div>
        ))}
        {mini ? (
          <>
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
              Other address spaces and coverage outside the expected programming image are unknown.
            </Text>
          </>
        ) : (
          <Text>
            Expected map not yet defined. Address spaces and coverage outside listed regions are
            unknown.
          </Text>
        )}
        {!mini &&
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
