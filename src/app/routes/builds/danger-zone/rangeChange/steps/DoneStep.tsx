import { Button } from '../../../../../components/v2/index.ts';
import classes from '../RangeChange.module.css';
import { COPY, rangeCaption, txText } from '../rangeChangeCopy.ts';
import type { StepProps } from './stepTypes.ts';

/** Done: what was put back, calibration, the CPS note, and Change back…. */
export default function DoneStep({ view, actions }: StepProps) {
  const to = view.toCode ?? view.radio?.identCode ?? 0;
  return (
    <div className={classes.stack}>
      <h2 className={classes.heading} data-testid="range-done-heading">
        {COPY.done.heading('Your radio', rangeCaption(to))}
      </h2>
      <p className={classes.text}>Transmit {txText(to)}.</p>
      {view.done.skipped ? <p className={classes.amber}>{COPY.done.notChecked}</p> : null}
      <section className={classes.card}>
        <h3 className={classes.heading}>{COPY.done.putBack}</h3>
        <ul className={classes.list}>
          {COPY.done.putBackItems.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </section>
      <p className={classes.text}>
        <strong>{COPY.done.calibrationTitle}.</strong>{' '}
        {view.done.calibrationChecked ? COPY.done.calibration : COPY.done.calibrationNotCompared}
      </p>
      <p className={classes.text}>
        <strong>{COPY.done.cpsTitle}.</strong> {COPY.done.cps}
      </p>
      <p className={classes.muted}>{COPY.done.keep}</p>
      <div className={classes.actions}>
        {view.done.changeBackCode !== null ? (
          <Button variant="secondary" size="sm" onClick={actions.onChangeBack}>
            {COPY.done.changeBack(rangeCaption(view.done.changeBackCode))}
          </Button>
        ) : null}
        <Button size="sm" onClick={actions.onBackToExport}>
          {COPY.done.back}
        </Button>
      </div>
    </div>
  );
}
