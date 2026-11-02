import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  DEFAULT_FULL_TOP_INSET_PX,
  DEFAULT_PEEK_PX,
  nextSnap,
  snapAfterDrag,
  snapHeights,
  type MapSheetSnap,
} from './mapSheetSnap.ts';
import classes from './MapSheet.module.css';

export type { MapSheetSnap } from './mapSheetSnap.ts';

/** Swallow the click a browser fires after a drag that ended over a header button. */
function suppressNextClick() {
  const stop = (ev: Event) => {
    ev.stopPropagation();
    ev.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
}

export interface MapSheetProps {
  /** Current snap point (controlled). */
  snap: MapSheetSnap;
  onSnapChange: (snap: MapSheetSnap) => void;
  /** Always-visible summary under the handle; fills the peek height. */
  header?: ReactNode;
  /** Scrollable body; visible from `half` upward. */
  children?: ReactNode;
  /** Sheet height at `peek` in px. Default: the measured height of the handle and header. */
  peekPx?: number;
  /** Room left above the sheet at `full` in px (default 84). */
  fullTopInsetPx?: number;
  /** Accessible name of the sheet. */
  label?: string;
  className?: string;
  /** Slim peek: a shorter grab area and a one-line header, for a control bar (pair with a small `peekPx`). */
  compact?: boolean;
  /** Dim the page behind the sheet above `peek`; tapping the dimmed area collapses to `peek`. */
  backdrop?: boolean;
  /** Tapping the grab handle toggles `peek` <-> `half` instead of cycling through all three. */
  toggleOnTap?: boolean;
}

/**
 * Bottom sheet with three snap points (peek / half / full) over a map. The parent must be
 * `position: relative` and sized (the sheet is absolutely positioned along its bottom edge).
 * Dependency-free: pointer events on the handle and header, CSS height transition.
 */
export default function MapSheet({
  snap,
  onSnapChange,
  header,
  children,
  peekPx,
  fullTopInsetPx = DEFAULT_FULL_TOP_INSET_PX,
  label = 'Results',
  className,
  compact = false,
  backdrop = false,
  toggleOnTap = false,
}: MapSheetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);
  const [containerPx, setContainerPx] = useState(0);
  const [grabPx, setGrabPx] = useState(0);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{
    startY: number;
    startH: number;
    lastY: number;
    lastT: number;
    v: number;
    onHeader: boolean;
  }>(null);
  const moved = useRef(false);

  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    const measure = () => setContainerPx(parent.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // Without an explicit `peekPx`, peek is exactly the handle and header (plus the sheet's top border).
  useLayoutEffect(() => {
    const root = rootRef.current;
    const grab = grabRef.current;
    if (peekPx != null || !root || !grab) return;
    const measure = () => setGrabPx(grab.offsetHeight + (root.offsetHeight - root.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grab);
    return () => ro.disconnect();
  }, [peekPx]);

  const heights = snapHeights(containerPx || 640, {
    peekPx: peekPx ?? (grabPx || DEFAULT_PEEK_PX),
    fullTopInsetPx,
  });
  const height = dragHeight ?? heights[snap];

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    moved.current = false;
    drag.current = {
      startY: e.clientY,
      startH: heights[snap],
      lastY: e.clientY,
      lastT: e.timeStamp,
      v: 0,
      onHeader: !target.closest('[role="slider"]'),
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.startY - e.clientY;
    if (!moved.current && Math.abs(dy) > 4) {
      moved.current = true;
      // Capture only once it is a drag, so a plain tap still reaches a header button.
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (!moved.current) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (d.lastY - e.clientY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    setDragHeight(Math.max(heights.peek, Math.min(heights.full, d.startH + dy)));
  };

  const tapSnap = useCallback(
    (current: MapSheetSnap): MapSheetSnap =>
      toggleOnTap ? (current === 'peek' ? 'half' : 'peek') : nextSnap(current),
    [toggleOnTap],
  );

  const endDrag = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      if (!moved.current) {
        setDragHeight(null);
        // Only the grabber is a tap target; header taps go to whatever was tapped.
        if (!d.onHeader) onSnapChange(tapSnap(snap));
        return;
      }
      if (d.onHeader) suppressNextClick();
      const finalH = Math.max(
        heights.peek,
        Math.min(heights.full, d.startH + d.startY - e.clientY),
      );
      setDragHeight(null);
      onSnapChange(snapAfterDrag(finalH, heights, d.v));
    },
    [heights, onSnapChange, snap, tapSnap],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onSnapChange(snap === 'peek' ? 'half' : 'full');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onSnapChange(snap === 'full' ? 'half' : 'peek');
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSnapChange(tapSnap(snap));
    }
  };

  // Keep scroll position sane when collapsing.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (snap === 'peek' && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [snap]);

  return (
    <>
      {backdrop && snap !== 'peek' ? (
        <button
          type="button"
          className={classes.backdrop}
          aria-label={`Close ${label.toLowerCase()}`}
          tabIndex={-1}
          onClick={() => onSnapChange('peek')}
        />
      ) : null}
      <div
        ref={rootRef}
        className={[
          classes.root,
          dragHeight != null ? classes.dragging : '',
          compact ? classes.compact : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ height }}
        role="region"
        aria-label={label}
        data-snap={snap}
      >
        <div
          ref={grabRef}
          className={classes.grab}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className={classes.handleZone}
            role="slider"
            tabIndex={0}
            aria-label={`${label} sheet size`}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={snap === 'peek' ? 0 : snap === 'half' ? 1 : 2}
            aria-valuetext={snap}
            onKeyDown={onKeyDown}
          >
            <span className={classes.handle} />
          </div>
          {header ? <div className={classes.header}>{header}</div> : null}
        </div>
        <div ref={bodyRef} className={classes.body}>
          {children}
        </div>
      </div>
    </>
  );
}
