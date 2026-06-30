import { Badge } from '@mantine/core';
import { modeColor, modeLabel, type ChannelMode } from '../../lib/channelModes.ts';

export interface ModePillProps {
  mode: ChannelMode;
  size?: 'xs' | 'sm' | 'md';
}

export default function ModePill({ mode, size = 'sm' }: ModePillProps) {
  return (
    <Badge size={size} style={{ backgroundColor: modeColor(mode), color: '#1a1b1e' }}>
      {modeLabel(mode)}
    </Badge>
  );
}
