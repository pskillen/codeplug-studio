import { Stack, Text, Title } from '@mantine/core';
import { useMemo } from 'react';
import {
  diffUv5rMiniChannels,
  formatUv5rMiniChannelChange,
  formatUv5rMiniSpecialSlot,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import type { DebugDecodedDiffProps } from './descriptors.ts';

/**
 * The Mini's decoded channel differences between the two chosen reads, in the shared compare's
 * decoded slot: changed slots by named field, and slots 248 and 249 kept apart. The byte verdict
 * above it comes from the shared `RadioCompare`. Replaced by the shared decoded diff in C3.
 */
export function Uv5rMiniCompareDecoded({ first, second }: DebugDecodedDiffProps) {
  const channels = useMemo(() => {
    const a = first.regions['clone'];
    const b = second.regions['clone'];
    return a && b ? diffUv5rMiniChannels(a, b) : undefined;
  }, [first, second]);
  if (!channels) return null;
  return (
    <Stack gap="xs">
      <Title order={4}>Channel differences</Title>
      {!channels.changes.length && !channels.special.length && (
        <Text size="sm">No channel differences.</Text>
      )}
      {channels.changes.map((change) => (
        <Text key={change.slot}>{formatUv5rMiniChannelChange(change)}</Text>
      ))}
      {channels.special.map((special) => (
        <Text key={special.slot}>{formatUv5rMiniSpecialSlot(special)}</Text>
      ))}
    </Stack>
  );
}
