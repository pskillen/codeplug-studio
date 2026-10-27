import { Progress } from '@mantine/core';
import RadioIoStageList from '../../../../../components/builds/RadioIoStageList.tsx';
import { Button } from '../../../../../components/v2/index.ts';
import classes from '../RangeChange.module.css';
import { COPY } from '../rangeChangeCopy.ts';
import NoticeBlock from './NoticeBlock.tsx';
import type { StepProps } from './stepTypes.ts';

/** Step 7: every restorable region, codeplug and settings together, in one session. */
export default function RestoreStep({ view, actions }: StepProps) {
  const percent = view.progress?.max
    ? Math.min(100, (100 * view.progress.cur) / view.progress.max)
    : undefined;
  return (
    <div className={classes.stack}>
      <p className={classes.text}>{COPY.restore.running(view.restore.backupTime ?? '')}</p>
      <div className={classes.stages}>
        <RadioIoStageList rows={view.restore.rows} progress={view.progress} />
        {view.busy ? (
          <Progress value={percent ?? 0} animated={percent == null} aria-label="Progress" mt={8} />
        ) : null}
      </div>
      {view.notice ? <NoticeBlock notice={view.notice} actions={actions} /> : null}
      {view.restore.failed && !view.busy ? (
        <div className={classes.actions}>
          <Button size="sm" onClick={actions.onRestoreAgain}>
            {COPY.restore.again}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
