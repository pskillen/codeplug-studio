import { Progress, Stack, Text } from '@mantine/core';
import type { BrandMeisterTalkGroupLookupProgress as LookupProgress } from '@integrations/repeaters/index.ts';

export interface BrandMeisterTalkGroupLookupProgressProps {
  progress: LookupProgress | null;
}

export default function BrandMeisterTalkGroupLookupProgressBar({
  progress,
}: BrandMeisterTalkGroupLookupProgressProps) {
  if (!progress) return null;

  return (
    <Stack gap="xs">
      <Text size="sm">{progress.message}</Text>
      <Progress value={progress.percent} animated />
    </Stack>
  );
}
