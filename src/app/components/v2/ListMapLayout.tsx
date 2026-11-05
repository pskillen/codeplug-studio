import { useMediaQuery } from '@mantine/hooks';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { stickyMapHeight } from '../../lib/stickyMapHeight.ts';
import MapSheet from './MapSheet.tsx';
import SegmentedControl from './SegmentedControl.tsx';
import type { MapSheetSnap } from './mapSheetSnap.ts';
import classes from './ListMapLayout.module.css';

/** Height of the controls sheet's slim peek bar (grabber + one line). */
const PEEK_PX = 56;
/** Room left above the controls sheet at `full`: the top bar's toggle stays reachable. */
const FULL_TOP_INSET_PX = 16;

export interface ListMapLayoutProps {
  /** Page header (title, count, actions). Above the split on desktop; top of the controls sheet on mobile. */
  head?: ReactNode;
  /** The list or table. Left pane on desktop, the list swipe pane on mobile. */
  list: ReactNode;
  /** Feedback about the list (e.g. a bulk-edit result). Top of the list pane on desktop and mobile, above `controls`. */
  notices?: ReactNode;
  /**
   * Filters, search, view switches and other page controls that sit above the list. On desktop they
   * render at the top of the list pane; on mobile they move into the bottom controls sheet so the
   * list pane starts at the table.
   */
  controls?: ReactNode;
  /**
   * Controls that must stay visible next to the list on mobile (search, filters): rendered at the
   * top of the list pane, above the list, instead of in the controls sheet. Ignored on desktop,
   * where `controls` already sits above the list.
   */
  listHeadControls?: ReactNode;
  /** The live map. Rendered once and fills its container (`height: 100%`). */
  map: ReactNode;
  /** Small controls tied to the map (e.g. Show my location). Above the map on desktop, in the controls sheet on mobile. */
  mapExtras?: ReactNode;
  /** Note under the map on desktop (legend); at the end of the extras in the controls sheet on mobile. */
  mapNote?: ReactNode;
  /** Short title in the mobile top bar, next to the Map | List toggle. */
  title: string;
  /** One-line summary in the mobile controls sheet's peek bar (e.g. "128 channels · 3 filters"). */
  controlsSummary?: ReactNode;
  /** Compact action at the right of the peek bar (e.g. a small New button). */
  controlsAction?: ReactNode;
  /** Initial controls sheet snap on mobile. Default `peek`; use `full` for a form to fill in first. */
  initialControlsSnap?: MapSheetSnap;
  /** Controlled controls sheet snap (mobile). Omit to let the layout manage it. */
  controlsSnap?: MapSheetSnap;
  onControlsSnapChange?: (snap: MapSheetSnap) => void;
  /** Accessible name stem for the panes and the controls sheet ("Channels" -> "Channels controls"). */
  sheetLabel?: string;
  /** Class for the desktop root (page padding). */
  desktopClassName?: string;
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
 * Mobile body: two ~92%-wide full-height panes (list, map) in a CSS scroll-snap track. The hidden
 * pane peeks in at the screen edge, and is covered by a button so tapping or dragging the strip
 * switches panes; a grab handle on the seam does the same. The visible map is not covered and sets
 * `touch-action: none`, so Leaflet keeps its own pan/zoom. A {@link MapSheet} of page controls
 * overlays the bottom of both panes.
 */
function SwipePanes({
  title,
  head,
  list,
  notices,
  controls,
  listHeadControls,
  map,
  mapExtras,
  mapNote,
  controlsSummary,
  controlsAction,
  initialControlsSnap = 'peek',
  controlsSnap,
  onControlsSnapChange,
  sheetLabel,
}: Omit<ListMapLayoutProps, 'desktopClassName'> & { sheetLabel: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState<SwipePane>('list');
  const [ownSnap, setOwnSnap] = useState<MapSheetSnap>(initialControlsSnap);
  const snap = controlsSnap ?? ownSnap;
  const setSnap = useCallback(
    (next: MapSheetSnap) => {
      setOwnSnap(next);
      onControlsSnapChange?.(next);
    },
    [onControlsSnapChange],
  );
  const lock = useRef<{ target: SwipePane; timer: number } | null>(null);
  const hasSheet = Boolean(head || controls || mapExtras || mapNote || controlsSummary);

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

  const peekPx = hasSheet ? PEEK_PX : 0;

  return (
    <div
      className={classes.mobile}
      style={{ '--controls-peek': `${peekPx}px` } as CSSProperties}
      data-swipe-layout=""
    >
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
      <div className={classes.swipeArea}>
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
              {notices}
              {listHeadControls}
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
        {hasSheet ? (
          <MapSheet
            snap={snap}
            onSnapChange={setSnap}
            label={`${sheetLabel} controls`}
            peekPx={PEEK_PX}
            fullTopInsetPx={FULL_TOP_INSET_PX}
            compact
            backdrop
            toggleOnTap
            header={
              <div className={classes.peekBar}>
                <button
                  type="button"
                  className={classes.peekSummary}
                  aria-expanded={snap !== 'peek'}
                  onClick={() => setSnap(snap === 'peek' ? 'half' : 'peek')}
                >
                  {controlsSummary ?? title}
                </button>
                {controlsAction ? <div className={classes.peekAction}>{controlsAction}</div> : null}
              </div>
            }
          >
            <div className={classes.sheetBody}>
              {head}
              {mapExtras || mapNote ? (
                <div className={classes.extras}>
                  {mapExtras}
                  {mapNote}
                </div>
              ) : null}
              {controls}
            </div>
          </MapSheet>
        ) : null}
      </div>
    </div>
  );
}

/**
 * List + map composition for library list pages (#1498). Desktop: the controls and list scroll
 * with the page and the map is sticky, filling the viewport height. Mobile: list and map are two
 * swipeable panes, with the page header and controls in a bottom {@link MapSheet}. The mobile
 * layout fills the viewport, so the route must be full-bleed on mobile (see `fullBleedRoutes.ts`).
 */
export default function ListMapLayout({
  head,
  list,
  notices,
  controls,
  listHeadControls,
  map,
  mapExtras,
  mapNote,
  title,
  controlsSummary,
  controlsAction,
  initialControlsSnap,
  controlsSnap,
  onControlsSnapChange,
  sheetLabel = 'Results',
  desktopClassName,
}: ListMapLayoutProps) {
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY, false, {
    getInitialValueInEffect: false,
  });
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
          <div className={classes.listPane}>
            {notices}
            {controls}
            {list}
          </div>
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

  return (
    <SwipePanes
      title={title}
      head={head}
      list={list}
      notices={notices}
      controls={controls}
      listHeadControls={listHeadControls}
      map={map}
      mapExtras={mapExtras}
      mapNote={mapNote}
      controlsSummary={controlsSummary}
      controlsAction={controlsAction}
      initialControlsSnap={initialControlsSnap}
      controlsSnap={controlsSnap}
      onControlsSnapChange={onControlsSnapChange}
      sheetLabel={sheetLabel}
    />
  );
}
