import { Progress } from '@mantine/core';
import RadioIoStageList from '../../../../../components/builds/RadioIoStageList.tsx';
import { Button, Checkbox } from '../../../../../components/v2/index.ts';
import classes from '../RangeChange.module.css';
import { COPY } from '../rangeChangeCopy.ts';
import NoticeBlock from './NoticeBlock.tsx';
import type { StepProps } from './stepTypes.ts';

/** Step 3: the full backup and the vital backup, saved together, then the "I've saved both files" tick. */
export default function BackUpStep({ view, actions }: StepProps) {
  const { backUp } = view;
  const percent = view.progress?.max
    ? Math.min(100, (100 * view.progress.cur) / view.progress.max)
    : undefined;
  return (
    <div className={classes.stack}>
      <p className={classes.text}>{COPY.backUp.intro}</p>
      {view.notice ? <NoticeBlock notice={view.notice} actions={actions} /> : null}
      {backUp.phase !== 'idle' ? (
        <div className={classes.stages}>
          <RadioIoStageList rows={backUp.rows} progress={view.progress} />
          {view.busy ? (
            <Progress
              value={percent ?? 0}
              animated={percent == null}
              aria-label="Progress"
              mt={8}
            />
          ) : null}
        </div>
      ) : null}
      {backUp.phase === 'saved' ? (
        <section className={classes.card} data-testid="range-saved-files">
          <p className={classes.text}>{COPY.backUp.saved}</p>
          <ul className={classes.list}>
            <li>
              {COPY.backUp.backupLabel}: {backUp.backupName}
              {backUp.summary ? ` · ${backUp.summary}` : ''}
            </li>
            <li>
              {COPY.backUp.vitalLabel}: {backUp.vitalName}
            </li>
          </ul>
          <label className={classes.checkRow}>
            <Checkbox
              checked={backUp.savedTick}
              onCheckedChange={actions.onSavedTick}
              aria-label={COPY.backUp.tickLabel}
            />
            <span>{COPY.backUp.tickLabel}</span>
          </label>
          <p className={classes.muted}>{COPY.backUp.tickHelp}</p>
        </section>
      ) : null}
      <div className={classes.actions}>
        <Button variant="secondary" size="sm" onClick={actions.onCancel}>
          Cancel
        </Button>
        {backUp.phase === 'saved' ? (
          <>
            <Button variant="secondary" size="sm" onClick={actions.onSaveAgain}>
              {COPY.backUp.saveAgain}
            </Button>
            <Button size="sm" onClick={actions.onBackUpNext} disabled={!backUp.savedTick}>
              {COPY.backUp.next}
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={actions.onBackUp} disabled={view.busy || !view.supported}>
            {view.notice ? COPY.backUp.tryAgain : COPY.backUp.start}
          </Button>
        )}
      </div>
    </div>
  );
}
