import { Text } from '@mantine/core';
import type { ChannelModeProfile } from '@core/models/library.ts';
import type { ModePanelProps } from './types.ts';

export default function PendingModePanel<P extends ChannelModeProfile>({
  profile: _profile,
}: ModePanelProps<P>) {
  return (
    <Text size="sm" c="dimmed">
      No additional fields for this mode yet.
    </Text>
  );
}