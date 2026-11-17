import type { DecodedChange } from '@integrations/radio-io/debugCompare/index.ts';
import { Group, Stack, Text, Title } from '@mantine/core';
import { SensitiveRevealButton } from '@app/components/debug/index.ts';
import { formatAddress } from '../viewerUtils.ts';

/** A side the record lacks reads a dash; a value the capture lacks reads hidden dots. */
function side(change: DecodedChange, which: 'a' | 'b'): string {
  const value = change[which];
  if (value !== undefined) return value;
  return (change.kind === 'added' && which === 'a') || (change.kind === 'removed' && which === 'b')
    ? '—'
    : '••';
}

/**
 * One line per changed value, grouped by section, the same for every radio: `record · label:
 * A → B` and the address when the decoder gave one. The changes come from the descriptor's compare
 * adapter through `diffDecoded` and `decodedChanges`; nothing here names a radio. A sensitive value
 * reads `changed` until Show password.
 */
export function DecodedChanges({
  changes,
  notCaptured,
  revealed,
  onToggleReveal,
}: {
  /** `undefined`: this radio's decoded changes are not available for these captures. */
  changes: readonly DecodedChange[] | undefined;
  /** Values not captured on a side: unknown, never counted as changes. */
  notCaptured: number;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const sections = [...new Set((changes ?? []).map((c) => c.section))];
  const hasSensitive = (changes ?? []).some((c) => c.sensitive);
  return (
    <Stack gap="xs">
      <Title order={4}>Decoded changes</Title>
      {!changes && <Text>Decoded changes are unavailable for these captures.</Text>}
      {changes && changes.length === 0 && <Text>No decoded changes.</Text>}
      {hasSensitive && (
        <Group gap="xs">
          <Text size="sm">Password values are {revealed ? 'shown' : 'hidden'}.</Text>
          <SensitiveRevealButton revealed={revealed} onToggle={onToggleReveal} />
        </Group>
      )}
      {sections.map((section) => (
        <Stack key={section} gap={2}>
          <Text fw={700} size="sm">
            {section}
          </Text>
          {changes!
            .filter((c) => c.section === section)
            .map((c, i) => (
              <Text key={`${c.record}:${c.label}:${i}`} size="sm">
                {c.record} · {c.label}:{' '}
                {c.sensitive && !revealed ? 'changed' : `${side(c, 'a')} → ${side(c, 'b')}`}
                {c.address !== undefined && ` · ${formatAddress(c.address)}`}
              </Text>
            ))}
        </Stack>
      ))}
      {changes && notCaptured > 0 && (
        <Text size="xs" c="dimmed">
          Not captured on at least one side: {notCaptured.toLocaleString()}{' '}
          {notCaptured === 1 ? 'value' : 'values'} (not counted as changes).
        </Text>
      )}
    </Stack>
  );
}
