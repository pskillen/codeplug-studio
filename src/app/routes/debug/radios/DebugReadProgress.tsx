import { Progress, Stack, Text } from '@mantine/core';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';

/**
 * Live status of a debug Read: the current stage (with "Stage i of n" when the radio declares its stage list), a
 * cur/max bar when the update has a total, and the adapter's message.
 */
export function DebugReadProgress({
  update,
  stages,
}: {
  update: ProgressUpdate | null;
  stages?: readonly string[];
}) {
  if (!update) return <Text>Connecting…</Text>;
  const index = update.stage && stages ? stages.indexOf(update.stage) : -1;
  return (
    <Stack gap={4} data-testid="debug-read-progress">
      {update.stage && (
        <Text fw={600} size="sm" data-testid="debug-read-stage">
          {index >= 0 && stages ? `Stage ${index + 1} of ${stages.length}: ` : ''}
          {update.stage}
        </Text>
      )}
      {update.max > 0 && (
        <Progress
          value={Math.min(100, (update.cur / update.max) * 100)}
          aria-label={`${update.stage ?? 'Read'} progress`}
          data-testid="debug-read-bar"
        />
      )}
      <Text size="sm">
        {update.msg}
        {update.max > 0 ? ` (${update.cur} / ${update.max})` : ''}
      </Text>
    </Stack>
  );
}
