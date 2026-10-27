import { Button } from '../../../../../components/v2/index.ts';
import classes from '../RangeChange.module.css';
import { COPY, rangeLabel, rxText, txText } from '../rangeChangeCopy.ts';
import NoticeBlock from './NoticeBlock.tsx';
import type { StepProps } from './stepTypes.ts';

/** Step 1: connect and read who the radio is. Nothing is written. */
export default function ReadStep({ view, actions }: StepProps) {
  const { radio } = view;
  const unfinished = view.notice?.kind === 'unfinished';
  return (
    <div className={classes.stack}>
      <p className={classes.text}>{COPY.read.intro}</p>
      {view.notice ? <NoticeBlock notice={view.notice} actions={actions} /> : null}
      {unfinished && radio ? (
        <div className={classes.actions}>
          <Button size="sm" onClick={() => actions.onResumeFromNotice(radio.serial)}>
            {COPY.banner.resume}
          </Button>
        </div>
      ) : null}
      {radio && !unfinished ? (
        <section className={classes.card} aria-label="This radio" data-testid="range-this-radio">
          <h2 className={classes.heading}>This radio</h2>
          <dl className={classes.rows}>
            <dt>Model</dt>
            <dd>{radio.label}</dd>
            <dt>Serial</dt>
            <dd>{radio.serial}</dd>
            {radio.firmware ? (
              <>
                <dt>Firmware</dt>
                <dd>{radio.firmware}</dd>
              </>
            ) : null}
            <dt>Frequency range</dt>
            <dd>{rangeLabel(radio.identCode)}</dd>
            <dt>Transmit</dt>
            <dd>{txText(radio.identCode)}</dd>
            <dt>Receive</dt>
            <dd>{rxText(radio.identCode)}</dd>
          </dl>
          {view.rawCodeNote ? <p className={classes.muted}>{view.rawCodeNote}</p> : null}
        </section>
      ) : null}
      {radio && !unfinished && view.currentUnlisted ? (
        <p className={classes.scary} role="alert" data-testid="range-unlisted-current">
          <strong>Unusual range</strong>
          {COPY.read.unlistedCurrent(radio.identCode)}
        </p>
      ) : null}
      <div className={classes.actions}>
        <Button variant="secondary" size="sm" onClick={actions.onCancel} disabled={view.busy}>
          Cancel
        </Button>
        {radio && !unfinished ? (
          <Button size="sm" onClick={actions.onReadNext} disabled={view.busy}>
            Next
          </Button>
        ) : (
          <Button size="sm" onClick={actions.onConnectRead} disabled={view.busy || !view.supported}>
            {view.busy ? COPY.read.reading : COPY.read.button}
          </Button>
        )}
      </div>
    </div>
  );
}
