import { useState } from 'react';
import classes from './RadioIoPanelCards.module.css';

export interface BeforeYouWriteRowsProps {
  radioLabel: string;
  /** Names of channels outside the radio's receive range (not written). */
  outOfRangeNames: readonly string[];
  /** D890: transmit limits depend on each radio's frequency range. */
  txRangeInfo?: boolean;
}

/** "Before you write": only the rows that apply. Renders nothing when none does. */
export default function BeforeYouWriteRows({
  radioLabel,
  outOfRangeNames,
  txRangeInfo,
}: BeforeYouWriteRowsProps) {
  const [open, setOpen] = useState(false);
  const n = outOfRangeNames.length;
  if (n === 0 && !txRangeInfo) return null;
  return (
    <section className={classes.card} aria-label="Before you write">
      <h3 className={classes.cardTitle}>Before you write</h3>
      <div className={classes.rows}>
        {n > 0 ? (
          <div className={classes.row}>
            <div className={classes.rowMain}>
              <span className={classes.warn} aria-hidden>
                ⚠
              </span>
              <span>
                {n} {n === 1 ? 'channel is' : 'channels are'} outside the {radioLabel}&apos;s
                receive range and won&apos;t be written.
              </span>
              <button
                type="button"
                className={classes.linkButton}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? 'Hide' : 'Show'}
              </button>
            </div>
            {open ? (
              <ul className={classes.nameList}>
                {outOfRangeNames.map((name, i) => (
                  <li key={`${i}-${name}`}>{name}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {txRangeInfo ? (
          <div className={classes.row}>
            <div className={classes.rowMain}>
              <span aria-hidden>ⓘ</span>
              <span>
                Transmit limits depend on each radio&apos;s frequency range. Studio checks them
                after it reads the radio.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
