import RestartCountdown from '../../../../../components/radio-io/RestartCountdown.tsx';
import { Button, ConfirmModal } from '../../../../../components/v2/index.ts';
import classes from '../RangeChange.module.css';
import { COPY } from '../rangeChangeCopy.ts';
import NoticeBlock from './NoticeBlock.tsx';
import type { StepProps } from './stepTypes.ts';

/** Step 6: wait for the restart, reconnect, and check the radio is the one that was changed. */
export default function RestartStep({ view, actions }: StepProps) {
  const { restart } = view;
  const kind = view.notice?.kind;
  return (
    <div className={classes.stack}>
      <p className={classes.text}>{COPY.restart.intro}</p>
      <RestartCountdown
        secondsLeft={restart.secondsLeft}
        totalSeconds={restart.totalSeconds}
        waitingText={COPY.restart.waiting}
        doneText={COPY.restart.afterCount}
        data-testid="range-restart-wait"
      />
      {restart.checklist.length > 0 ? (
        <ul className={classes.checklist} data-testid="range-checklist">
          {restart.checklist.map((c) => (
            <li key={c.id}>
              {c.ok ? '✓' : '✗'} {c.text}
            </li>
          ))}
        </ul>
      ) : null}
      {view.notice ? <NoticeBlock notice={view.notice} actions={actions} /> : null}
      {restart.verified ? <p className={classes.muted}>{COPY.restart.programError}</p> : null}
      <div className={classes.actions}>
        {kind === 'still-old' || kind === 'resume-nothing-changed' ? (
          <>
            <Button variant="secondary" size="sm" onClick={actions.onFinish}>
              {COPY.restart.finish}
            </Button>
            <Button size="sm" onClick={actions.onStartAgain}>
              {COPY.restart.tryAgain}
            </Button>
          </>
        ) : restart.verified ? (
          <Button size="sm" onClick={actions.onRestore} disabled={view.busy}>
            {COPY.restart.restoreButton}
          </Button>
        ) : (
          <>
            {kind === 'no-port' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => actions.onReconnect(true)}
                disabled={view.busy}
              >
                {COPY.restart.choosePort}
              </Button>
            ) : null}
            {restart.anywayAvailable ? (
              <Button variant="secondary" size="sm" onClick={actions.onRestoreAnywayOpen}>
                {COPY.restart.restoreAnyway}
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => actions.onReconnect(false)}
              disabled={!restart.canReconnect}
            >
              {COPY.restart.reconnect}
            </Button>
          </>
        )}
      </div>
      <ConfirmModal
        open={restart.anywayOpen}
        onClose={actions.onRestoreAnywayClose}
        onConfirm={actions.onRestoreAnywayConfirm}
        title={COPY.restart.anywayTitle}
        confirmLabel={COPY.restart.anywayConfirm}
        tone="destructive"
      >
        <p className={classes.text}>{COPY.restart.anywayBody}</p>
      </ConfirmModal>
    </div>
  );
}
