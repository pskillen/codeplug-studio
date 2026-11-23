import { Badge } from '@mantine/core';
import { modeColor, modeLabel, type ChannelMode } from '../../lib/channelModes.ts';
import classes from './ModePill.module.css';

export interface ModePillProps {
  mode: ChannelMode;
  size?: 'xs' | 'sm' | 'md';
  /** When true, draws a primary-coloured border and a visually hidden " (main mode)". */
  isMain?: boolean;
}

export default function ModePill({ mode, size = 'sm', isMain = false }: ModePillProps) {
  return (
    <Badge
      size={size}
      className={isMain ? classes.main : undefined}
      style={{ backgroundColor: modeColor(mode), color: '#1a1b1e' }}
    >
      {modeLabel(mode)}
      {isMain ? <span className={classes.srOnly}> (main mode)</span> : null}
    </Badge>
  );
}
