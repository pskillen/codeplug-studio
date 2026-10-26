/**
 * One part in the Write stepper's "What to write" list (#1393, 60-write-ui-design §2).
 * A tick, a title, a summary line, and options that show only while the part is ticked.
 */

import type { ReactNode } from 'react';
import { Checkbox } from '../../v2/index.ts';
import classes from './RadioWriteStepper.module.css';

export interface WritePartRowProps {
  /** Part title; also the checkbox's accessible name. */
  title: string;
  /** One line under the title. */
  summary?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Options for this part. Rendered only while `checked`. */
  children?: ReactNode;
}

export default function WritePartRow({
  title,
  summary,
  checked,
  onCheckedChange,
  disabled = false,
  children,
}: WritePartRowProps) {
  return (
    <div className={classes.partRow} data-checked={checked ? 'true' : 'false'}>
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
        className={classes.partTick}
      />
      <div className={classes.partBody}>
        <div className={classes.partTitle}>{title}</div>
        {summary ? <div className={classes.partSummary}>{summary}</div> : null}
        {checked && children ? <div className={classes.partOptions}>{children}</div> : null}
      </div>
    </div>
  );
}
