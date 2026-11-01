import { useMediaQuery } from '@mantine/hooks';
import { useState, type ReactNode } from 'react';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import {
  DesignSystemV2Provider,
  MapSheet,
  SegmentedControl,
  snapForView,
  viewForSnap,
  type MapListView,
  type MapSheetSnap,
} from '../v2/index.ts';
import classes from './MapToolLayout.module.css';

export interface MapToolLayoutProps {
  /** The map; it is rendered once and fills its container (`height: 100%`). */
  map: ReactNode;
  /** Page title and one-line description (desktop column head; mobile sheet body head). */
  title: string;
  description?: ReactNode;
  /** Controls and results. Left column on desktop, sheet body on mobile. */
  children: ReactNode;
  /**
   * Mobile layout. `sheet`: full-screen map with a three-snap bottom sheet.
   * `stack`: a scrolling page with a short map inline (My locator).
   */
  mobile?: 'sheet' | 'stack';
  /** Always-visible sheet summary (mobile `sheet`). */
  sheetHeader?: ReactNode;
  /** Initial sheet snap (mobile `sheet`). Default `half`. */
  initialSnap?: MapSheetSnap;
  /** Rendered under the heading on desktop only (e.g. the readout the mobile sheet shows as its header). */
  desktopLead?: ReactNode;
  /** Show the floating Map | List toggle over the map (mobile `sheet`). */
  showViewToggle?: boolean;
  /** Floating chip over the top-left of the map (mobile `sheet`), e.g. the current point. */
  mapOverlay?: ReactNode;
  /** Small hint pill over the map on desktop. */
  mapHint?: ReactNode;
  /** In `stack` mode, rendered after the map instead of before it. */
  afterMap?: ReactNode;
  /** Sheet accessible label. */
  sheetLabel?: string;
}

/**
 * Responsive shell for map tools. Desktop: fixed-width scrolling left column and a map that fills the
 * rest of the viewport. Mobile: full-screen map under a {@link MapSheet}, or a stacked page.
 * Fills the height the app layout gives full-bleed routes (`/tools/*`).
 */
export default function MapToolLayout({
  map,
  title,
  description,
  children,
  mobile = 'sheet',
  sheetHeader,
  desktopLead,
  initialSnap = 'half',
  showViewToggle = false,
  mapOverlay,
  mapHint,
  afterMap,
  sheetLabel = 'Results',
}: MapToolLayoutProps) {
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY, false, {
    getInitialValueInEffect: false,
  });
  const [snap, setSnap] = useState<MapSheetSnap>(initialSnap);

  const head = (
    <div className={classes.head}>
      <h1 className={classes.title}>{title}</h1>
      {description ? <p className={classes.description}>{description}</p> : null}
    </div>
  );

  if (!isMobile) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.desktop}>
          <aside className={classes.column}>
            <div className={classes.columnBody}>
              {head}
              {desktopLead}
              {children}
              {afterMap}
            </div>
          </aside>
          <div className={classes.mapArea}>
            {map}
            {mapHint ? <div className={classes.hint}>{mapHint}</div> : null}
          </div>
        </div>
      </DesignSystemV2Provider>
    );
  }

  if (mobile === 'stack') {
    return (
      <DesignSystemV2Provider>
        <div className={classes.stack}>
          <div className={classes.stackBody}>
            {head}
            {children}
          </div>
          <div className={classes.stackMap}>{map}</div>
          {afterMap ? <div className={classes.stackBody}>{afterMap}</div> : null}
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.sheetRoot}>
        <div className={classes.fullMap}>{map}</div>
        <div className={classes.topRow}>
          {mapOverlay ? <div className={classes.overlay}>{mapOverlay}</div> : <span />}
          {showViewToggle ? (
            <div className={classes.toggle}>
              <SegmentedControl
                value={viewForSnap(snap)}
                onChange={(v) => setSnap(snapForView(v as MapListView))}
                options={[
                  { value: 'map', label: 'Map' },
                  { value: 'list', label: 'List' },
                ]}
              />
            </div>
          ) : null}
        </div>
        <MapSheet snap={snap} onSnapChange={setSnap} header={sheetHeader} label={sheetLabel}>
          <div className={classes.sheetBody}>{children}</div>
        </MapSheet>
      </div>
    </DesignSystemV2Provider>
  );
}
