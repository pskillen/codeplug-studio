import { Group } from '@mantine/core';
import type { ChannelMode as CoreChannelMode } from '@core/models/libraryTypes.ts';
import type { ChannelMode } from '../../lib/channelModes.ts';
import ModePill from './ModePill.tsx';

export interface ModePillsForRepeaterListingProps {
  modes: CoreChannelMode[];
  size?: 'xs' | 'sm' | 'md';
}

export default function ModePillsForRepeaterListing({
  modes,
  size = 'sm',
}: ModePillsForRepeaterListingProps) {
  if (modes.length === 0) {
    return <ModePill mode="other" size={size} />;
  }

  return (
    <Group gap={4}>
      {modes.map((mode) => (
        <ModePill key={mode} mode={mode as ChannelMode} size={size} />
      ))}
    </Group>
  );
}
