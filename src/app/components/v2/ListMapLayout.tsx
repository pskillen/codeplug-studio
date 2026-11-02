import { useMediaQuery } from '@mantine/hooks';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
   * `swipe` (EXPERIMENTAL, full-bleed route): list and map as two side-by-side panes you swipe between.
   */
  mobile?: 'sheet' | 'stack' | 'swipe';
}

type SwipePane = 'list' | 'map';

/** Which pane a horizontal scroll position of the swipe track is nearest to. */
function paneForScroll(el: HTMLElement): SwipePane {
  const max = el.scrollWidth - el.clientWidth;
  return max > 0 && el.scrollLeft > max / 2 ? 'map' : 'list';
}

/**
 * Grab handle (and the invisible dead zone beneath it): a solid tab straddling the seam between the active pane and the peeking one. It is a
 * descendant of the scroll track (inside a zero-width sticky anchor), so a horizontal drag on it
 * scrolls the track, and a tap switches panes.
 */
function SwipeHandle({ pane, onGo }: { pane: SwipePane; onGo: (target: SwipePane) => void }) {
  const toMap = pane === 'list';
  return (
    <div className={classes.swipeAnchor} data-pane={pane}>
      <div className={classes.swipeDead} data-swipe-dead="" aria-hidden="true" />
      <button
        type="button"
        className={classes.swipeHandle}
        aria-label={toMap ? 'Show map' : 'Show list'}
        onClick={() => onGo(toMap ? 'map' : 'list')}
      >
        <span className={classes.swipeTab} aria-hidden="true">
          <svg viewBox="0 0 8 12" width="9" height="14" className={classes.swipeChevron}>
            <path
              d={toMap ? 'M6 1 2 6l4 5' : 'M2 1l4 5-4 5'}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={classes.swipeGrip}>
            <span />
            <span />
          </span>
        </span>
      </button>
    </div>
  );
}

/**
 * EXPERIMENTAL mobile body for `mobile="swipe"`: two ~92%-wide full-height panes in a CSS scroll-snap
 * track. The hidden pane peeks in at the screen edge, and is covered by a button so tapping or
 * dragging the strip switches panes. The visible map is not covered and sets `touch-action: none`,
 * so Leaflet keeps its own pan/zoom.
 */
function SwipePanes({
  title,
  head,
  list,
  map,
  mapExtras,
  mapNote,
  sheetLabel,
}: Pick<ListMapLayoutProps, 'title' | 'head' | 'list' | 'map' | 'mapExtras' | 'mapNote'> & {
  sheetLabel: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState<SwipePane>('list');
  const lock = useRef<{ target: SwipePane; timer: number } | null>(null);

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const next = paneForScroll(el);
    if (lock.current) {
      // A programmatic scroll is animating: wait until it arrives rather than flip-flopping.
      if (next !== lock.current.target) return;
      window.clearTimeout(lock.current.timer);
      lock.current = null;
    }
    setPane(next);
  }, []);

  const goTo = useCallback((target: SwipePane) => {
    const el = trackRef.current;
    setPane(target);
    if (!el) return;
    if (lock.current) window.clearTimeout(lock.current.timer);
    lock.current = {
      target,
      timer: window.setTimeout(() => {
        lock.current = null;
      }, 900),
    };
    const left = target === 'map' ? el.scrollWidth - el.clientWidth : 0;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
    } else {
      el.scrollLeft = left;
    }
  }, []);

  useEffect(
    () => () => {
      if (lock.current) window.clearTimeout(lock.current.timer);
    },
    [],
  );

  // The map can be laid out while peeking; nudge Leaflet to re-measure once it is the active pane.
  useEffect(() => {
    if (pane === 'map') window.dispatchEvent(new Event('resize'));
  }, [pane]);

  return (
    <div className={classes.mobile} data-swipe-experiment="">
      <div className={classes.topBar}>
        <span className={classes.topTitle}>{title}</span>
        <SegmentedControl
          value={pane}
          onChange={(v) => goTo(v as SwipePane)}
          options={[
            { value: 'map', label: 'Map' },
            { value: 'list', label: 'List' },
          ]}
        />
      </div>
      <div
        ref={trackRef}
        className={classes.swipeTrack}
        onScroll={onScroll}
        data-pane={pane}
        aria-label={sheetLabel}
      >
        <SwipeHandle pane={pane} onGo={goTo} />
        <section className={classes.swipeListPane} aria-label={`${sheetLabel} list`}>
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
          {pane !== 'list' ? (
            <button
              type="button"
              className={classes.swipeCover}
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => goTo('list')}
            />
          ) : null}
        </section>
        <section className={classes.swipeMapPane} aria-label={`${sheetLabel} map`}>
          <div className={`${classes.fullMap} ${classes.swipeMapFill}`}>{map}</div>
          {pane !== 'map' ? (
            <button
              type="button"
              className={classes.swipeCover}
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => goTo('map')}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
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

  if (mobile === 'swipe') {
    return (
      <SwipePanes
        title={title}
        head={head}
        list={list}
        map={map}
        mapExtras={mapExtras}
        mapNote={mapNote}
        sheetLabel={sheetLabel}
      />
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
