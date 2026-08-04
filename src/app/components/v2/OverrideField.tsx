import type { ReactNode } from 'react';
import Pill from './Pill.tsx';
import classes from './OverrideField.module.css';

export interface OverrideFieldProps {
  label: string;
  description?: string;
  /** Shown after description when not overridden — e.g. library wire name. */
  libraryHint?: string;
  /** When true, shows the overridden state with reset affordance. */
  overridden?: boolean;
  /** Accent-tint background for the active/highlighted row. */
  highlighted?: boolean;
  onOverride?: () => void;
  onReset?: () => void;
  /** Optional nested control(s) under the row (app extension; not in DS JSX). */
  children?: ReactNode;
  className?: string;
}

/**
 * Build-override pattern: library default vs per-build override with reset.
 * Matches the design-system row chrome (flat, not a bordered card).
 */
export default function OverrideField({
  label,
  description,
  libraryHint,
  overridden = false,
  highlighted = false,
  onOverride,
  onReset,
  children,
  className,
}: OverrideFieldProps) {
  return (
    <div
      className={[classes.root, highlighted ? classes.highlighted : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={classes.copy}>
        <div className={classes.label}>{label}</div>
        {description || (libraryHint && !overridden) ? (
          <div className={overridden ? classes.descriptionOverridden : classes.description}>
            {description}
            {libraryHint && !overridden ? (
              <span className={classes.libraryHint}> ({libraryHint})</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={classes.actions}>
        {overridden ? (
          <>
            <Pill tone="accent">Overridden for this build</Pill>
            {onReset ? (
              <button type="button" className={classes.reset} onClick={onReset}>
                Reset ✕
              </button>
            ) : null}
          </>
        ) : (
          <>
            <span className={classes.defaultHint}>using library default</span>
            {onOverride ? (
              <button type="button" className={classes.override} onClick={onOverride}>
                Override for this build
              </button>
            ) : null}
          </>
        )}
      </div>
      {children ? <div className={classes.body}>{children}</div> : null}
    </div>
  );
}
