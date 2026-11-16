import { Stack, Text, Title } from '@mantine/core';
import { rt95ArchiveDetails } from './captureArchive.ts';
import { Rt95CalibrationDiff } from './Rt95Calibration.tsx';
import type { DebugDecodedDiffProps } from './descriptors.ts';

/**
 * Temporary: the RT95 channel-name and settings change lines that the old shared Compare showed,
 * plus the calibration field changes. Replaced by the decoded diff (C3, #1785).
 */
export function Rt95CompareDecoded({ first, second }: DebugDecodedDiffProps) {
  const a = rt95ArchiveDetails(first)?.summary;
  const b = rt95ArchiveDetails(second)?.summary;
  const changes: string[] = [];
  if (a && b) {
    for (const row of a.settingsRetain) {
      const next = b.settingsRetain.find((item) => item.label === row.label);
      if (next && next.value !== row.value)
        changes.push(`${row.label}: ${row.value} → ${next.value}`);
    }
    const slots = new Set([
      ...a.inspectChannels.map((item) => item.slotIndex),
      ...b.inspectChannels.map((item) => item.slotIndex),
    ]);
    for (const slot of slots) {
      const before = a.inspectChannels.find((item) => item.slotIndex === slot)?.name;
      const after = b.inspectChannels.find((item) => item.slotIndex === slot)?.name;
      if (before !== after)
        changes.push(`Channel slot ${slot}: ${before ?? '(empty)'} → ${after ?? '(empty)'}`);
    }
  }
  return (
    <Stack>
      <Title order={4}>Decoded changes</Title>
      <Text size="sm" c="dimmed">
        Decoded from the programming image; provenance unknown.
      </Text>
      {!a || !b ? (
        <Text>Decoded changes are unavailable for these captures.</Text>
      ) : changes.length ? (
        changes.map((change) => <Text key={change}>{change}</Text>)
      ) : (
        <Text>No decoded channel name or setting changes.</Text>
      )}
      <Rt95CalibrationDiff first={first} second={second} />
    </Stack>
  );
}
