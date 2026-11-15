import { Alert, Button, FileButton, Select, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import {
  compareUv5rMiniReads,
  diffUv5rMiniChannels,
  formatUv5rMiniChannelChange,
  formatUv5rMiniSpanRange,
  formatUv5rMiniSpecialSlot,
  hashUv5rMiniDebugSpans,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import type { Uv5rMiniDebugRead } from '../uv5rMiniDebugReads.ts';
import { openDebugArchive } from './captureArchive.ts';
import { openUv5rMiniReadsZip } from './uv5rMiniLegacyArchive.ts';

export function Uv5rMiniCompare({
  reads,
  preferredLive,
}: {
  reads: readonly Uv5rMiniDebugRead[];
  preferredLive?: string | null;
}) {
  const [first, setFirst] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    label: string | null;
    preferredLive?: string | null;
  }>();
  const second = selection?.preferredLive === preferredLive ? selection?.label : preferredLive;
  const [files, setFiles] = useState<readonly Uv5rMiniDebugRead[]>([]);
  const [error, setError] = useState<string>();
  const all = [...reads, ...files];
  async function open(file: File | null) {
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let loaded: Uv5rMiniDebugRead[];
      try {
        const archive = openDebugArchive(bytes, 'UV-5R Mini');
        const decoded = archive.regions.clone;
        if (!decoded || decoded.length !== 0x10000)
          throw new Error('A complete clone capture is required for comparison.');
        loaded = [
          {
            label: 'File',
            readAt: new Date(archive.manifest.capturedAt),
            decoded,
            raw: archive.sidecars['debug/wire.bin']!,
            ident: { f: archive.sidecars['debug/f.bin']!, m: archive.sidecars['debug/m.bin']! },
            spans: hashUv5rMiniDebugSpans(decoded),
          },
        ];
      } catch (err) {
        try {
          loaded = openUv5rMiniReadsZip(bytes);
        } catch {
          throw err;
        }
      }
      setFiles(loaded.map((read, i) => ({ ...read, label: `Comparison file ${i + 1}` })));
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open comparison archive.');
    }
  }
  const picker = (
    <FileButton onChange={open} accept=".zip,application/zip">
      {(props) => (
        <Button variant="default" {...props}>
          Open comparison archive
        </Button>
      )}
    </FileButton>
  );
  if (all.length < 2)
    return (
      <Stack>
        {picker}
        {error && <Alert color="red">{error}</Alert>}
        <Alert title="Two complete captures required">
          Read or open another complete clone capture to compare.
        </Alert>
      </Stack>
    );
  const a = all.find((r) => r.label === first) ?? all[all.length - 2]!;
  const b = all.find((r) => r.label === second) ?? all[all.length - 1]!;
  const options = all.map((r) => ({
    value: r.label,
    label: `${r.label} (${r.readAt.toLocaleString()})`,
  }));
  const compare = compareUv5rMiniReads(a.decoded, b.decoded);
  const channels = diffUv5rMiniChannels(a.decoded, b.decoded);
  return (
    <Stack>
      <Title order={3}>Compare Mini reads</Title>
      {picker}
      {error && <Alert color="red">{error}</Alert>}
      <Select label="First read" value={a.label} onChange={setFirst} data={options} />
      <Select
        label="Second read"
        value={b.label}
        onChange={(label) => setSelection({ label, preferredLive })}
        data={options}
      />
      <Alert
        color={compare.identical ? 'green' : 'red'}
        title={compare.identical ? 'Identical compared spans' : 'Compared spans differ'}
      >
        Log sectors are skipped; VFO and settings are reported separately without deciding the
        verdict.
      </Alert>
      {compare.lines.map((line) => (
        <Text key={`${line.kind}-${line.span.id}`}>
          {formatUv5rMiniSpanRange(line.span)} · {line.span.label} ·{' '}
          {line.kind === 'skipped' ? 'skipped' : `${line.diffOffsets.length} bytes differ`} ·{' '}
          {line.kind}
          {line.diffOffsets.length > 0 &&
            ` · ${line.diffOffsets
              .slice(0, 32)
              .map((offset) => `0x${offset.toString(16).toUpperCase().padStart(4, '0')}`)
              .join(' ')}${line.diffOffsets.length > 32 ? ' …' : ''}`}
        </Text>
      ))}
      <Title order={4}>Channel differences</Title>
      {channels.changes.map((change) => (
        <Text key={change.slot}>{formatUv5rMiniChannelChange(change)}</Text>
      ))}
      {channels.special.map((special) => (
        <Text key={special.slot}>{formatUv5rMiniSpecialSlot(special)}</Text>
      ))}
    </Stack>
  );
}
