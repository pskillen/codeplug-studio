import { Progress, Text } from '@mantine/core';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import RadioIoStageList from '../../builds/RadioIoStageList.tsx';
import {
  EMPTY_TRACKER,
  advanceTracker,
  etaSeconds,
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
  /**
   * Seconds left from writeEstimate (the Review step's estimate). Used until the live estimate from
   * the stage weights and progress events is ready; shown only once steady and while running.
   */
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

  // What the 1 s estimate timer reads: the latest rows, progress and tracker, without re-rendering.
  const latestRef = useRef({ rows, progress, tracker: EMPTY_TRACKER });
  useEffect(() => {
    setTracker((prev) => {
      const next = advanceTracker(prev, rows, progress, clockRef.current());
      latestRef.current = { rows, progress, tracker: next };
      return next;
    });
  }, [rows, progress]);

  // The live estimate, from the stage weights and the events so far, refreshed about once a second
  // (the same estimate RadioIoStageList shows). It needs weighted rows and 2 s of events.
  const [liveEtaSeconds, setLiveEtaSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const { rows: r, progress: p, tracker: t } = latestRef.current;
      setLiveEtaSeconds(etaSeconds(r, t, p, clockRef.current()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const { fraction, total } = overallProgress(rows, tracker, progress);
  const showOverall = total > 0;
  const secondsLeft = (running ? liveEtaSeconds : null) ?? estimateSeconds ?? null;
  const showEstimate = running && elapsed >= 2 && secondsLeft != null && secondsLeft > 0;
  const estimateLabel = showEstimate ? `${formatEstimate(secondsLeft)} left` : null;
  const percentLabel = showOverall && running ? `${Math.round(fraction * 100)}%` : null;
  const countLabel =
    running && progress && progress.max > 1
      ? `${progress.stage ? `${progress.stage}: ` : ''}${progress.cur.toLocaleString()} of ${progress.max.toLocaleString()}`
      : null;

  const showHeadings = groups.length > 1;
  const extras = progress as ProgressWithBytes | null;
  const bytesLine = extras?.bytes != null ? `${extras.bytes.toLocaleString()} bytes` : null;
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
        {percentLabel ? <span data-testid="stage-progress-percent">{percentLabel}</span> : null}
        {countLabel ? <span data-testid="stage-progress-count">{countLabel}</span> : null}
        {estimateLabel ? <span data-testid="stage-progress-estimate">{estimateLabel}</span> : null}
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
          <div className={planNotStarted(group.rows, running) ? classes.planPending : undefined}>
            <RadioIoStageList rows={group.rows} progress={progress} hideOverall />
          </div>
        </div>
      ))}
    </div>
  );
}
