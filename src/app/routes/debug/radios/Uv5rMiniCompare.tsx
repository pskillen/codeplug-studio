import { Alert, Button, FileButton, Select, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import {
  compareUv5rMiniReads,
  diffUv5rMiniChannels,
  formatUv5rMiniChannelChange,
  formatUv5rMiniSpanRange,
  formatUv5rMiniSpecialSlot,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import type { Uv5rMiniDebugRead } from '../uv5rMiniDebugReads.ts';

export function Uv5rMiniCompare({
  reads,
  preferredLive,
  onOpenArchive,
}: {
  reads: readonly Uv5rMiniDebugRead[];
  preferredLive?: string | null;
  onOpenArchive: (file: File | null) => void;
}) {
  const [first, setFirst] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    label: string | null;
    preferredLive?: string | null;
  }>();
  const second = selection?.preferredLive === preferredLive ? selection?.label : preferredLive;
  const all = reads;
  const picker = (
    <FileButton onChange={onOpenArchive} accept=".zip,application/zip">
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
