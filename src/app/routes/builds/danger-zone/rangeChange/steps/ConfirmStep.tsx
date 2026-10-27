import { Button, Checkbox } from '../../../../../components/v2/index.ts';
import classes from '../RangeChange.module.css';
import { COPY, rangeCaption } from '../rangeChangeCopy.ts';
import type { StepProps } from './stepTypes.ts';

/** Step 4: what will happen, a checkbox, and the one red button. */
export default function ConfirmStep({ view, actions }: StepProps) {
  const { radio, target } = view;
  if (!radio || target === null) return null;
  const to = rangeCaption(target);
  const unlisted = view.rangeRows.find((r) => r.code === target)?.unlisted ?? false;
  return (
    <div className={classes.stack}>
      <h2 className={classes.heading}>
        {COPY.confirm.heading(radio.label, radio.serial, rangeCaption(radio.identCode), to)}
      </h2>
      <ol className={classes.list}>
        {COPY.confirm.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <p className={classes.text}>{COPY.confirm.until}</p>
      {view.confirm.receiveOnly && view.confirm.receiveOnly.count > 0 ? (
        <p className={classes.amber} data-testid="range-receive-only">
          {COPY.confirm.receiveOnly(
            view.confirm.receiveOnly.count,
            view.confirm.receiveOnly.total,
            to,
          )}
        </p>
      ) : null}
      {view.confirm.opens ? (
        <p className={classes.amber} data-testid="range-opens">
          {COPY.confirm.opens(view.confirm.opens)}
        </p>
      ) : null}
      {unlisted ? (
        <p className={classes.amber} data-testid="range-unlisted-confirm">
          <strong>{COPY.confirm.unlisted(target)}</strong>
        </p>
      ) : null}
      <label className={classes.checkRow}>
        <Checkbox
          checked={view.confirm.ticked}
          onCheckedChange={actions.onConfirmTick}
          aria-label={COPY.confirm.tick}
        />
        <span>{COPY.confirm.tick}</span>
      </label>
      <div className={classes.actions}>
        <Button variant="secondary" size="sm" onClick={actions.onCancel}>
          {COPY.confirm.cancel}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={actions.onChange}
          disabled={!view.confirm.ticked || view.busy}
        >
          {COPY.confirm.button}
        </Button>
      </div>
      <p className={classes.muted}>Cancel: nothing has changed.</p>
    </div>
  );
}
