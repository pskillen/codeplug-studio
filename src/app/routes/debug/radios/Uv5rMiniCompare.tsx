import { Alert, Stack, Text, Title } from '@mantine/core';
import {
  compareUv5rMiniReads,
  diffUv5rMiniChannels,
  formatUv5rMiniChannelChange,
  formatUv5rMiniSpanRange,
  formatUv5rMiniSpecialSlot,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import type { Uv5rMiniDebugRead } from '../uv5rMiniDebugReads.ts';

/** The Mini's compare of the two reads the shared picker chose (A and B). */
export function Uv5rMiniCompare({ a, b }: { a?: Uv5rMiniDebugRead; b?: Uv5rMiniDebugRead }) {
  if (!a || !b)
    return (
      <Alert title="Two complete captures required">
        Pick two different complete clone captures (A and B) to compare.
      </Alert>
    );
  const compare = compareUv5rMiniReads(a.decoded, b.decoded);
  const channels = diffUv5rMiniChannels(a.decoded, b.decoded);
  return (
    <Stack>
      <Title order={3}>
        Compare Mini reads {a.label} and {b.label}
      </Title>
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
