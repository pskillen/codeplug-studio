import { Button } from '../../../../../components/v2/index.ts';
import classes from '../RangeChange.module.css';
import { COPY } from '../rangeChangeCopy.ts';
import NoticeBlock from './NoticeBlock.tsx';
import type { StepProps } from './stepTypes.ts';

/** Step 5: one frame, then END. The user should barely see it. */
export default function ChangeStep({ view, actions }: StepProps) {
  return (
    <div className={classes.stack}>
      {view.busy ? <p className={classes.text}>{COPY.change.running}</p> : null}
      {view.notice ? <NoticeBlock notice={view.notice} actions={actions} /> : null}
      {!view.busy && view.notice ? (
        <div className={classes.actions}>
          {view.notice.kind === 'unknown' ? (
            <Button
              size="sm"
              onClick={() => view.radio && actions.onResumeFromNotice(view.radio.serial)}
            >
              {COPY.banner.resume}
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={actions.onBackToExport}>
                {COPY.done.back}
              </Button>
              <Button size="sm" onClick={actions.onStartAgain}>
                {COPY.change.startAgain}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
