/**
 * Fixed-height stage list with an overall bar and time remaining (#1393, workflow design §2.5).
 * Rows come from the caller (the progress modal, later the Write stepper); the component tracks
 * progress, draws done / current / pending rows, and keeps the current row in view without ever
 * changing its own height, so the bar above and the buttons below never move.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Progress } from '@mantine/core';
import { IconCircleCheck, IconCircleDashed, IconCircleX, IconLoader2 } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './RadioIoStageList.module.css';
import {
  EMPTY_TRACKER,
  advanceTracker,
  etaSeconds,
  formatEta,
  overallProgress,
  rowFraction,
  type StageRow,
  type StageRowStatus,
} from './radioIoStageProgress.ts';

export type { StageRow } from './radioIoStageProgress.ts';

/** Visible rows before the list scrolls. */
export const STAGE_LIST_VISIBLE_ROWS = 8;
/** Row pitch in px; the list height is this times the visible rows. */
export const STAGE_LIST_ROW_PX = 28;

export interface RadioIoStageListProps {
  rows: readonly StageRow[];
  progress: ProgressUpdate | null;
  /** Hide the overall bar and estimate (rows without weights never show them anyway). */
  hideOverall?: boolean;
}

const ICON: Record<StageRowStatus, ReactNode> = {
  pending: <IconCircleDashed size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
  active: <IconLoader2 size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
  success: <IconCircleCheck size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
  error: <IconCircleX size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
};

const ICON_CLASS: Record<StageRowStatus, string> = {
  pending: classes.iconPending ?? '',
  active: classes.iconActive ?? '',
  success: classes.iconSuccess ?? '',
  error: classes.iconError ?? '',
};

export default function RadioIoStageList({
  rows,
  progress,
  hideOverall = false,
}: RadioIoStageListProps) {
  const [tracker, setTracker] = useState(EMPTY_TRACKER);
  const [now, setNow] = useState(() => Date.now());
  const activeRef = useRef<HTMLLIElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Fold each progress event into the tracker.
  useEffect(() => {
    const t = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- folds an external event stream (progress) into the tracker
    setTracker((prev) => advanceTracker(prev, rows, progress, t));
    setNow(t);
  }, [rows, progress]);

  // Keep the current row visible inside the fixed-height list, about a third from the top so the
  // next pending rows stay in view. Scrolls the list only, never the modal or the page.
  const activeId = rows.find((r) => r.status === 'active')?.id;
  useEffect(() => {
    const list = listRef.current;
    const row = activeRef.current;
    if (!list || !row) return;
    const target = row.offsetTop - (list.clientHeight || 0) / 3;
    list.scrollTop = Math.max(0, target);
  }, [activeId]);

  // Let the estimate appear after 2 s even if no event arrives in between.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const overall = useMemo(
    () => overallProgress(rows, tracker, progress),
    [rows, tracker, progress],
  );
  const eta = useMemo(
    () => etaSeconds(rows, tracker, progress, now),
    [rows, tracker, progress, now],
  );
  const showOverall = !hideOverall && overall.total > 0;

  return (
    <div className={classes.root}>
      {showOverall ? (
        <div className={classes.overall}>
          <Progress
            value={Math.round(overall.fraction * 100)}
            size="sm"
            aria-label="Overall progress"
          />
          <div className={classes.overallText}>
            <span>{Math.round(overall.fraction * 100)}%</span>
            <span data-testid="stage-list-eta">{eta != null ? formatEta(eta) : ''}</span>
          </div>
        </div>
      ) : null}
      <ul
        ref={listRef}
        className={classes.list}
        data-testid="stage-list"
        style={{
          maxHeight: STAGE_LIST_VISIBLE_ROWS * STAGE_LIST_ROW_PX,
          overflowY: 'auto',
        }}
      >
        {rows.map((row) => {
          const active = row.status === 'active';
          return (
            <li
              key={row.id}
              ref={active ? activeRef : undefined}
              className={classes.row}
              style={{ minHeight: STAGE_LIST_ROW_PX }}
              data-status={row.status}
            >
              <span className={[classes.icon, ICON_CLASS[row.status]].join(' ')} aria-hidden>
                {ICON[row.status]}
              </span>
              <span className={classes.copy}>
                <span className={classes.label}>{row.label}</span>
                {row.detail ? <span className={classes.detail}>{row.detail}</span> : null}
              </span>
              {active && row.weight != null && !row.coarse && progress?.max ? (
                <Progress
                  value={Math.round(rowFraction(row, tracker, progress) * 100)}
                  size="xs"
                  className={classes.stepBar}
                  aria-label={`${row.label} progress`}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
