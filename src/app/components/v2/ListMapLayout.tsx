import { useMediaQuery } from '@mantine/hooks';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { stickyMapHeight } from '../../lib/stickyMapHeight.ts';
import MapSheet from './MapSheet.tsx';
import SegmentedControl from './SegmentedControl.tsx';
import { snapForView, viewForSnap, type MapListView, type MapSheetSnap } from './mapSheetSnap.ts';
import classes from './ListMapLayout.module.css';

const PEEK_PX = 96;

export interface ListMapLayoutProps {
  /** Page header (title, count, actions). Above the split on desktop; top of the sheet body on mobile. */
  head?: ReactNode;
  /** The list or table. Left pane on desktop, sheet body on mobile. */
  list: ReactNode;
  /** The live map. Rendered once and fills its container (`height: 100%`). */
  map: ReactNode;
  /** Small controls tied to the map (e.g. Show my location). Above the map on desktop, above the list on mobile. */
  mapExtras?: ReactNode;
  /** Note under the map on desktop (legend); at the end of the extras on mobile. */
  mapNote?: ReactNode;
  /** Short title in the mobile top bar, next to the Map | List toggle. */
  title: string;
  /** Always-visible sheet summary on mobile. */
  sheetHeader?: ReactNode;
  /** Initial sheet snap on mobile. Use `full` when there is nothing useful on the map. Default `half`. */
  initialSnap?: MapSheetSnap;
  sheetLabel?: string;
  /** Class for the desktop root (page padding). */
  desktopClassName?: string;
  /**
   * Mobile layout. `sheet` (default): full-screen map under a bottom sheet; the route must be full-bleed.
   * `stack`: map above the list in normal page flow, for pages that scroll a long form first.
   */
  mobile?: 'sheet' | 'stack';
}

/**
 * List + map composition for library list pages (#1498). Desktop: the list scrolls with the page and
 * the map is sticky, filling the viewport height. Mobile: a full-screen map under a three-snap
 * {@link MapSheet} with a Map | List toggle that only snaps the sheet. The mobile layout fills the
 * viewport, so the route must be full-bleed on mobile (see `fullBleedRoutes.ts`).
 */
export default function ListMapLayout({
  head,
  list,
  map,
  mapExtras,
  mapNote,
  title,
  sheetHeader,
  initialSnap = 'half',
  sheetLabel = 'Results',
  desktopClassName,
  mobile = 'sheet',
}: ListMapLayoutProps) {
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY, false, {
    getInitialValueInEffect: false,
  });
  const [snap, setSnap] = useState<MapSheetSnap>(initialSnap);
  const paneRef = useRef<HTMLDivElement>(null);
  const [mapHeight, setMapHeight] = useState<number | null>(null);

  // Desktop: fit the sticky map to the first screen below the app chrome.
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (isMobile || !pane) return;
    const measure = () => {
      const top = pane.getBoundingClientRect().top + window.scrollY;
      setMapHeight(stickyMapHeight(window.innerHeight, top));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [isMobile]);

  if (!isMobile) {
    return (
      <div className={[classes.desktop, desktopClassName].filter(Boolean).join(' ')}>
        {head}
        <div className={classes.split}>
          <div className={classes.listPane}>{list}</div>
          <div ref={paneRef} className={classes.mapPane}>
            <div
              className={classes.stickyMap}
              style={mapHeight != null ? { height: mapHeight } : undefined}
            >
              {mapExtras ? <div className={classes.extras}>{mapExtras}</div> : null}
              <div className={classes.mapFrame}>{map}</div>
              {mapNote ? <div className={classes.note}>{mapNote}</div> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mobile === 'stack') {
    return (
      <div className={classes.stack}>
        {head}
        {mapExtras ? <div className={classes.extras}>{mapExtras}</div> : null}
        <div className={classes.stackMap}>{map}</div>
        {mapNote ? <div className={classes.note}>{mapNote}</div> : null}
        {list}
      </div>
    );
  }

  return (
    <div className={classes.mobile}>
      <div className={classes.topBar}>
        <span className={classes.topTitle}>{title}</span>
        <SegmentedControl
          value={viewForSnap(snap)}
          onChange={(v) => setSnap(snapForView(v as MapListView))}
          options={[
            { value: 'map', label: 'Map' },
            { value: 'list', label: 'List' },
          ]}
        />
      </div>
      <div className={classes.sheetArea}>
        <div className={classes.fullMap}>{map}</div>
        <MapSheet
          snap={snap}
          onSnapChange={setSnap}
          header={sheetHeader}
          label={sheetLabel}
          peekPx={PEEK_PX}
        >
          <div className={classes.sheetBody}>
            {head}
            {mapExtras || mapNote ? (
              <div className={classes.extras}>
                {mapExtras}
                {mapNote}
              </div>
            ) : null}
            {list}
          </div>
        </MapSheet>
      </div>
    </div>
  );
}
