import RadioIoStageList from '../../../../../components/builds/RadioIoStageList.tsx';
import RestartCountdown from '../../../../../components/radio-io/RestartCountdown.tsx';
import { Button } from '../../../../../components/v2/index.ts';
import { DANGER_ZONE_DECISIONS } from '../../../../../services/dangerZone/decisions.ts';
import classes from '../RangeChange.module.css';
import { COPY } from '../rangeChangeCopy.ts';
import NoticeBlock from './NoticeBlock.tsx';
import type { StepProps } from './stepTypes.ts';

/** Step 8: read back and compare. Never automatic: the user presses Check, or skips. */
export default function CheckStep({ view, actions }: StepProps) {
  const { check } = view;
  const differs = view.notice?.kind === 'check-differs';
  return (
    <div className={classes.stack}>
      <p className={classes.text}>{COPY.check.intro}</p>
      <RestartCountdown
        secondsLeft={check.secondsLeft}
        totalSeconds={check.totalSeconds}
        waitingText={COPY.restart.waiting}
        doneText={COPY.check.waitDone}
        data-testid="range-check-wait"
      />
      {view.busy ? (
        <div className={classes.stages}>
          <RadioIoStageList rows={check.rows} progress={view.progress} />
        </div>
      ) : null}
      {view.notice ? <NoticeBlock notice={view.notice} actions={actions} /> : null}
      <p className={classes.muted} data-testid="range-program-error">
        {DANGER_ZONE_DECISIONS.programErrorAdvice === 'stay-connected'
          ? COPY.check.programErrorStay
          : COPY.check.programErrorInit}
      </p>
      <div className={classes.actions}>
        <Button variant="secondary" size="sm" onClick={actions.onSkipCheck} disabled={view.busy}>
          {COPY.check.skip}
        </Button>
        {differs ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={actions.onRestoreAgain}
            disabled={view.busy}
          >
            {COPY.restore.again}
          </Button>
        ) : null}
        <Button size="sm" onClick={actions.onCheck} disabled={view.busy || check.secondsLeft > 0}>
          {COPY.check.button}
        </Button>
      </div>
    </div>
  );
}
