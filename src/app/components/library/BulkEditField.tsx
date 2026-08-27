import type { ReactNode } from 'react';
import GradientSegmentedControl, {
  GRADIENT_SEGMENT_IDLE_VALUE,
} from '../ui/GradientSegmentedControl.tsx';
import { BULK_IDLE_OPTION } from '../../lib/bulkEditIdle.ts';
import classes from './BulkEditField.module.css';

const SET_VALUE = 'set';

export interface BulkEditFieldProps {
  optedIn: boolean;
  onOptedInChange: (optedIn: boolean) => void;
  /** When every selected row shares a value, invert puts the primary indicator on Set. */
  hasSharedValue?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

/**
 * Opt-in chrome for bulk-edit sliders and selects: **No change** vs **Set**,
 * using the same gradient control as other bulk fields.
 */
export default function BulkEditField({
  optedIn,
  onOptedInChange,
  hasSharedValue = false,
  label,
  description,
  children,
  disabled = false,
}: BulkEditFieldProps) {
  return (
    <div className={classes.root}>
      <GradientSegmentedControl
        label={label}
        description={description}
        value={optedIn ? SET_VALUE : GRADIENT_SEGMENT_IDLE_VALUE}
        onChange={(next) => onOptedInChange(next === SET_VALUE)}
        idleOption={BULK_IDLE_OPTION}
        sharedValue={hasSharedValue ? SET_VALUE : undefined}
        data={[{ value: SET_VALUE, label: 'Set' }]}
        scheme="onOff"
        layout="column"
        size="sm"
        disabled={disabled}
      />
      <fieldset className={classes.body} disabled={!optedIn || disabled}>
        {children}
      </fieldset>
    </div>
  );
}
