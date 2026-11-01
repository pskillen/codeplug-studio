import { IconArrowsMaximize } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './MapThumbnail.module.css';

export interface MapThumbnailProps {
  /** Live map (non-interactive here); fills the box. */
  children: ReactNode;
  /** Accessible name; also the caption. */
  label: string;
  onOpen: () => void;
}

/**
 * Small, read-only map that opens a {@link FullScreenMapSheet} when tapped — keeps long mobile
 * editors short while the map stays one tap away (#1498).
 */
export default function MapThumbnail({ children, label, onOpen }: MapThumbnailProps) {
  return (
    <div className={classes.root}>
      <div className={classes.map} aria-hidden>
        {children}
      </div>
      <button type="button" className={classes.hit} onClick={onOpen} aria-label={label}>
        <span className={classes.caption}>
          <IconArrowsMaximize size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
          {label}
        </span>
      </button>
    </div>
  );
}
