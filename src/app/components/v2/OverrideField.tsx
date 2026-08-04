import type { ReactNode } from 'react';
import Button from './Button.tsx';
import Pill from './Pill.tsx';
import classes from './OverrideField.module.css';

export interface OverrideFieldProps {
  label: string;
  description?: string;
  /** When true, shows the overridden state with reset affordance. */
  overridden: boolean;
  onOverride?: () => void;
  onReset?: () => void;
  /** Field control(s) shown when overridden (or always, for editors). */
  children?: ReactNode;
  className?: string;
}

/**
 * Build-override pattern: library default vs per-build override with reset.
 */
export default function OverrideField({
  label,
  description,
  overridden,
  onOverride,
  onReset,
  children,
  className,
}: OverrideFieldProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      <div className={classes.header}>
        <div className={classes.copy}>
          <div className={classes.label}>{label}</div>
          {description ? <div className={classes.description}>{description}</div> : null}
        </div>
        {overridden ? (
          <div className={classes.actions}>
            <Pill tone="accent">Overridden for this build</Pill>
            {onReset ? (
              <Button variant="ghost" size="sm" onClick={onReset}>
                Reset
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={classes.actions}>
            <span className={classes.defaultHint}>using library default</span>
            {onOverride ? (
              <Button variant="ghost" size="sm" onClick={onOverride}>
                Override for this build
              </Button>
            ) : null}
          </div>
        )}
      </div>
      {children ? <div className={classes.body}>{children}</div> : null}
    </div>
  );
}
