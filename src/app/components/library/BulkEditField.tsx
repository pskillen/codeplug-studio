import type { ReactNode } from 'react';
import { SegmentedControl } from '../v2/index.ts';
import classes from './BulkEditField.module.css';

export interface BulkEditFieldProps {
  optedIn: boolean;
  onOptedInChange: (optedIn: boolean) => void;
  /** Shown when every selected row shares a value and the field is still idle. */
  sharedHint?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

/**
 * Opt-in chrome for bulk-edit sliders and selects: **No change** vs **Set**.
 * The wrapped control stays visible (so a shared value can be previewed) and is
 * disabled while idle.
 */
export default function BulkEditField({
  optedIn,
  onOptedInChange,
  sharedHint,
  children,
  disabled = false,
}: BulkEditFieldProps) {
  return (
    <div className={classes.root}>
      <SegmentedControl
        size="sm"
        aria-label="Apply this field"
        value={optedIn ? 'set' : 'idle'}
        disabled={disabled}
        onChange={(next) => onOptedInChange(next === 'set')}
        options={[
          { value: 'idle', label: 'No change' },
          { value: 'set', label: 'Set' },
        ]}
      />
      {!optedIn && sharedHint != null ? (
        <p className={classes.sharedHint}>Shared value: {sharedHint}</p>
      ) : null}
      <fieldset className={classes.body} disabled={!optedIn || disabled}>
        {children}
      </fieldset>
    </div>
  );
}
