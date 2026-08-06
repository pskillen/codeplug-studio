import { useMediaQuery } from '@mantine/hooks';
import { useState, type ReactNode } from 'react';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { Button } from '../v2/index.ts';
import classes from './LibraryMapStack.module.css';

export type LibraryMapLayout = 'stacked' | 'split';

export interface LibraryMapStackProps {
  layout: LibraryMapLayout;
  list: ReactNode;
  map: ReactNode;
  /** When true, narrow viewports show a Show map toggle (C7 mobile). */
  mobileMapToggle?: boolean;
  className?: string;
}

/**
 * C7 map + list composition — stacked (Channels) or split (Zones) with optional mobile collapse.
 */
export default function LibraryMapStack({
  layout,
  list,
  map,
  mobileMapToggle = true,
  className,
}: LibraryMapStackProps) {
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);
  const [mapVisible, setMapVisible] = useState(false);
  const showMap = !isMobile || !mobileMapToggle || mapVisible;

  if (layout === 'split' && !isMobile) {
    return (
      <div className={[classes.root, classes.split, className].filter(Boolean).join(' ')}>
        <div className={classes.listPane}>{list}</div>
        <div className={classes.mapPane}>{map}</div>
      </div>
    );
  }

  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      <div className={classes.listPane}>{list}</div>
      {isMobile && mobileMapToggle ? (
        <div className={classes.mapToggleRow}>
          <Button variant="secondary" size="sm" onClick={() => setMapVisible((prev) => !prev)}>
            {mapVisible ? 'Hide map' : 'Show map'}
          </Button>
        </div>
      ) : null}
      <div className={showMap ? classes.mapPane : classes.mapCollapsed}>{map}</div>
    </div>
  );
}
