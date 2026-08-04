import type { ReactNode } from 'react';
import classes from './CountTile.module.css';

export interface CountTileProps {
  value: ReactNode;
  /** Optional denominator shown as `/total` beside value. */
  total?: ReactNode;
  label: string;
  className?: string;
}

/**
 * Big-number stat tile for summary grids and build counts.
 */
export default function CountTile({ value, total, label, className }: CountTileProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      <div className={classes.valueRow}>
        {value}
        {total != null ? <span className={classes.total}>/{total}</span> : null}
      </div>
      <div className={classes.label}>{label}</div>
    </div>
  );
}
