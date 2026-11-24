import { Progress, Text } from '@mantine/core';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import RadioIoStageList from '../../builds/RadioIoStageList.tsx';
import {
  EMPTY_TRACKER,
  advanceTracker,
  overallProgress,
  type StageRow,
} from '../../builds/radioIoStageProgress.ts';
import { formatEstimate } from '../../builds/RadioWriteStepper/writeEstimate.ts';
import type { WriteStageRow } from '../../builds/RadioWriteStepper/types.ts';
import { formatElapsed, useElapsedSeconds } from './useElapsedSeconds.ts';
import classes from './StageProgress.module.css';

export interface StageProgressGroup {
  id: string;
  /** Heading shown above the rows when there is more than one group. */
  title?: string;
  rows: readonly WriteStageRow[];
}

export interface StageProgressProps {
  groups: readonly StageProgressGroup[];
  progress: ProgressUpdate | null;
  /** When the run started (ms); elapsed time is always shown while running and at the end. */
  startedAt: number | null;
  /** Seconds left, from writeEstimate; shown only once steady (2 s after start) and while running. */
  estimateSeconds?: number | null;
  running: boolean;
  /** Text above the list, e.g. "Connecting to … and reading it…". */
  lead?: ReactNode;
  testId?: string;
}

function allRows(groups: readonly StageProgressGroup[]): StageRow[] {
  return groups.flatMap((g) => g.rows);
}

function planNotStarted(rows: readonly StageRow[], running: boolean): boolean {
  return running && rows.some((r) => r.weight != null) && !rows.some((r) => r.status !== 'pending');
}

type ProgressWithBytes = ProgressUpdate & { bytes?: number; bytesPerSecond?: number };

export default function StageProgress({
  groups,
  progress,
  startedAt,
  estimateSeconds,
  running,
  lead,
  testId = 'stage-progress',
}: StageProgressProps) {
  const rows = useMemo(() => allRows(groups), [groups]);
  const elapsed = useElapsedSeconds(startedAt, running || startedAt != null);
  const [tracker, setTracker] = useState(EMPTY_TRACKER);
  const clockRef = useRef(() =>
    typeof performance !== 'undefined' ? performance.now() : Date.now(),
  );

  useEffect(() => {
    setTracker((prev) => advanceTracker(prev, rows, progress, clockRef.current()));
  }, [rows, progress]);

  const { fraction, total } = overallProgress(rows, tracker, progress);
  const showOverall = total > 0;
  const showEstimate =
    running &&
    elapsed >= 2 &&
    estimateSeconds != null &&
    estimateSeconds > 0;
  const estimateLabel = showEstimate ? `${formatEstimate(estimateSeconds)} left` : null;

  const showHeadings = groups.length > 1;
  const extras = progress as ProgressWithBytes | null;
  const bytesLine =
    extras?.bytes != null
      ? `${extras.bytes.toLocaleString()} bytes`
      : null;
  const rateLine =
    extras?.bytesPerSecond != null
      ? `${Math.round(extras.bytesPerSecond).toLocaleString()} B/s`
      : null;

  return (
    <div className={classes.root} data-testid={testId}>
      {lead ? <div className={classes.lead}>{lead}</div> : null}
      {showOverall ? (
        <Progress
          value={Math.round(fraction * 100)}
          size="sm"
          aria-label="Overall progress"
          data-testid="stage-progress-overall"
        />
      ) : !showOverall && running && rows.length === 0 ? (
        <Progress value={0} size="sm" animated aria-label="Overall progress" />
      ) : null}
      <div className={classes.meta}>
        <span data-testid="stage-progress-elapsed">{formatElapsed(elapsed)}</span>
        {estimateLabel ? (
          <span data-testid="stage-progress-estimate">{estimateLabel}</span>
        ) : null}
        {bytesLine ? <span data-testid="stage-progress-bytes">{bytesLine}</span> : null}
        {rateLine ? <span data-testid="stage-progress-rate">{rateLine}</span> : null}
      </div>
      {groups.map((group) => (
        <div key={group.id}>
          {showHeadings && group.title ? (
            <Text className={classes.groupTitle} component="div">
              {group.title}
            </Text>
          ) : null}
          <div
            className={planNotStarted(group.rows, running) ? classes.planPending : undefined}
          >
            <RadioIoStageList rows={group.rows} progress={progress} hideOverall />
          </div>
        </div>
      ))}
    </div>
  );
}