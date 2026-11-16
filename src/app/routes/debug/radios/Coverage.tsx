import { Card, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { archiveGaps, type DebugArchive } from './captureArchive.ts';
import { descriptorFor, formatAddress, regionIdentity } from './viewerUtils.ts';

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
  // What differs per radio (region headings, start label, summary, body) comes from its descriptor.
  const view = descriptorFor(archive)?.coverage?.(archive);
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Title order={4}>Coverage manifest</Title>
        <Text>
          Source: {archive.source === 'file' ? 'Local archive' : 'Live read'} · Captured:{' '}
          {archive.manifest.capturedAt}
        </Text>
        {view?.summary}
        {archive.manifest.regions.map((region) => (
          <div key={region.id}>
            <Text fw={600}>
              {view?.regionKind?.(region.id) ??
                regionIdentity(archive, region.id)?.space ??
                'Unclassified address space'}
            </Text>
            <Text>
              {region.label} · {view?.startLabel?.(region.id) ?? 'Start'}{' '}
              {formatAddress(region.address)} · {region.byteLength} bytes
              {view?.omitCaptured ? '' : ' · Captured'}
            </Text>
            <RegionHash bytes={archive.regions[region.id]!} />
          </div>
        ))}
        {view ? (
          view.body
        ) : (
          <Text>
            Expected map not yet defined. Address spaces and coverage outside listed regions are
            unknown.
          </Text>
        )}
        {!view &&
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
