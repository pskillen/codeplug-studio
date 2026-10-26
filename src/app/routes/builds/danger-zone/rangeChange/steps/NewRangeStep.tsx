import { Button } from '../../../../../components/v2/index.ts';
import classes from '../RangeChange.module.css';
import { COPY } from '../rangeChangeCopy.ts';
import type { StepProps } from './stepTypes.ts';

/** Step 2: pick the new range. Every range is listed; the current one is ticked and disabled. */
export default function NewRangeStep({ view, actions }: StepProps) {
  const picked = view.rangeRows.find((r) => r.code === view.target);
  return (
    <div className={classes.stack}>
      <p className={classes.text}>{COPY.newRange.intro}</p>
      <ul className={classes.rangeList} role="radiogroup" aria-label="New frequency range">
        {view.rangeRows.map((row) => {
          const id = `range-${row.code}`;
          const selected = row.current || view.target === row.code;
          return (
            <li key={row.code}>
              <label
                className={classes.rangeRow}
                data-selected={selected}
                data-disabled={!row.selectable}
                htmlFor={id}
              >
                <input
                  id={id}
                  type="radio"
                  name="new-range"
                  checked={selected}
                  disabled={!row.selectable}
                  onChange={() => actions.onPickTarget(row.code)}
                />
                <span className={classes.rangeText}>
                  <span className={classes.rangeName}>
                    {row.caption} <span className={classes.muted}>(code {row.code})</span>
                    {row.current ? (
                      <span className={classes.tag}>{COPY.newRange.current}</span>
                    ) : null}
                    {row.unlisted ? (
                      <span className={classes.tag}>{COPY.newRange.notOffered}</span>
                    ) : null}
                    {row.direction ? (
                      <span className={classes.tag}>{COPY.newRange[row.direction]}</span>
                    ) : null}
                  </span>
                  <span>{row.transmitLine}</span>
                  {row.uhfOff ? <span>{COPY.newRange.uhfOff}</span> : null}
                  {row.current ? null : <span>{row.receiveLine}</span>}
                  {row.disabledReason ? (
                    <span className={classes.muted}>{row.disabledReason}</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {picked?.unlisted ? (
        <p className={classes.scary} role="alert" data-testid="range-unlisted-target">
          <strong>{COPY.newRange.unlistedTitle}</strong>
          {COPY.newRange.unlistedTarget(picked.code)}
        </p>
      ) : null}
      {picked?.narrowReceive ? (
        <p className={classes.amber} data-testid="range-narrow">
          {COPY.newRange.narrow}
        </p>
      ) : null}
      <p className={classes.amber} data-testid="range-regulatory">
        {COPY.newRange.regulatory}
      </p>
      <div className={classes.actions}>
        <Button variant="secondary" size="sm" onClick={actions.onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={actions.onRangeNext} disabled={view.target === null}>
          {COPY.newRange.next}
        </Button>
      </div>
    </div>
  );
}
