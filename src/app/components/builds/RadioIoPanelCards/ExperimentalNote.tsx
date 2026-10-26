import { useState, type ReactNode } from 'react';
import { Alert } from '@mantine/core';
import classes from './RadioIoPanelCards.module.css';

export interface ExperimentalNoteProps {
  /** The long "how Write works" paragraph, shown under the link. */
  details?: ReactNode;
}

/** One-line experimental warning; the full text and the how-Write-works paragraph sit behind a link. */
export default function ExperimentalNote({ details }: ExperimentalNoteProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className={classes.experimental}>
        Web Serial is experimental. Keep a backup of the radio before you write.{' '}
        <button
          type="button"
          className={classes.linkButton}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide details' : 'Details'}
        </button>
      </p>
      {open ? (
        <Alert color="orange" mt="xs">
          <p className={classes.line}>
            Writing a radio from the browser is under active development. It is riskier than
            established CPS tools such as CHIRP, NeonPlug, or the manufacturer&apos;s own software.
            Prefer those tools for important programming until this pathway is marked stable.
          </p>
          {details ? (
            <p className={classes.line} style={{ marginTop: 8 }}>
              {details}
            </p>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
