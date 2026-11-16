import { Badge, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { useMemo } from 'react';
import { compareVerdict } from '@integrations/radio-io/debugCompare/index.ts';
import { useDebugReadHistory, type DebugReadHistoryStore } from '../debugReadHistory.ts';
import type { RadioDebugDescriptor } from '../descriptors.ts';

/**
 * Read-to-read strip: each read against the one before it, one line each ("B = A, identical",
 * "E ≠ D, 3 bytes"). Clicking a line sets the Compare tab's A and B to that pair. Uses the radio's
 * byte adapter only, so it is radio-neutral.
 */
export function ReadStrip({
  descriptor,
  store,
}: {
  descriptor: Pick<RadioDebugDescriptor, 'compare'>;
  store: DebugReadHistoryStore;
}) {
  const { entries, comparePair } = useDebugReadHistory(store);
  const adapter = descriptor.compare;
  const lines = useMemo(
    () =>
      adapter
        ? entries.slice(1).map((entry, i) => {
            const previous = entries[i]!;
            const comparison = adapter.sections(previous.archive, entry.archive);
            const result = comparison.error ? undefined : compareVerdict(comparison);
            return { previous, entry, result };
          })
        : [],
    [adapter, entries],
  );
  if (!lines.length) return null;
  return (
    <Stack gap={2} role="list" aria-label="Each read against the one before">
      {lines.map(({ previous, entry, result }) => {
        const identical = result?.verdict === 'identical';
        const text = !result
          ? `${entry.label} vs ${previous.label}, not comparable`
          : result.verdict === 'nothing-compared'
            ? `${entry.label} vs ${previous.label}, nothing comparable`
            : identical
              ? `${entry.label} = ${previous.label}, identical`
              : `${entry.label} ≠ ${previous.label}, ${result.changedBytes.toLocaleString()} ${result.changedBytes === 1 ? 'byte' : 'bytes'}`;
        const active = comparePair.a === previous.id && comparePair.b === entry.id;
        return (
          <UnstyledButton
            key={entry.id}
            role="listitem"
            aria-label={`Compare ${previous.label} and ${entry.label}: ${text}`}
            aria-current={active ? 'true' : undefined}
            onClick={() => store.setComparePair({ a: previous.id, b: entry.id })}
          >
            <Group gap="xs" wrap="nowrap">
              <Badge
                circle
                size="xs"
                color={identical ? 'green' : result?.verdict === 'changed' ? 'yellow' : 'gray'}
                aria-hidden
              />
              <Text size="sm" fw={active ? 700 : undefined}>
                {text}
              </Text>
            </Group>
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}
