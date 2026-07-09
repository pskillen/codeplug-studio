import { Badge } from '@mantine/core';
import { modeColor, modeLabel, type ChannelMode } from '../../lib/channelModes.ts';

export interface ModePillProps {
  mode: ChannelMode;
  size?: 'xs' | 'sm' | 'md';
  /** When true, append "(primary)" to the pill label. */
  primary?: boolean;
}

export default function ModePill({ mode, size = 'sm', primary = false }: ModePillProps) {
  const label = primary ? `${modeLabel(mode)} (primary)` : modeLabel(mode);
  return (
    <Badge size={size} style={{ backgroundColor: modeColor(mode), color: '#1a1b1e' }}>
      {label}
    </Badge>
  );
}
