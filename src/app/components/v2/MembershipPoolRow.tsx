import type { ReactNode } from 'react';
import Checkbox from './Checkbox.tsx';
import classes from './MembershipPoolRow.module.css';

export interface MembershipPoolRowProps {
  checked?: boolean;
  onCheck?: () => void;
  /** Blocked-but-visible candidate: greyed, disabled checkbox, visible reason. */
  disabled?: boolean;
  label: ReactNode;
  subtitle?: ReactNode;
  /** Hidden when `disabled`. */
  pills?: ReactNode;
  /** Blocked-reason text shown when `disabled`. Falls back to `subtitle`. */
  reason?: ReactNode;
  className?: string;
}

/**
 * Pool ("B" role) candidate row for {@link AddMembersScreen}. Purely an
 * add-candidate — no drag, no remove. `disabled` gives the native checkbox's
 * disabled state as the structural enforcement that a blocked candidate can
 * never enter a staged-selection payload — consumers don't need a runtime guard.
 */
export default function MembershipPoolRow({
  checked,
  onCheck,
  disabled,
  label,
  subtitle,
  pills,
  reason,
  className,
}: MembershipPoolRowProps) {
  return (
    <div
      className={[classes.root, disabled ? classes.disabled : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={disabled ? undefined : onCheck}
        aria-label={typeof label === 'string' ? `Add ${label}` : 'Add item'}
      />
      <div className={classes.copy}>
        <div className={classes.labelRow}>
          <span className={classes.label}>{label}</span>
          {!disabled && pills ? <span className={classes.pills}>{pills}</span> : null}
        </div>
        {disabled ? (
          <div className={classes.reason}>{reason ?? subtitle}</div>
        ) : subtitle ? (
          <div className={classes.subtitle}>{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
