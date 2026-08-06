import type { ReactNode } from 'react';
import classes from './LibraryInventoryPage.module.css';

export interface LibraryInventoryHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export default function LibraryInventoryHeader({
  title,
  subtitle,
  actions,
}: LibraryInventoryHeaderProps) {
  return (
    <div className={classes.headerRow}>
      <div>
        <h1 className={classes.title}>{title}</h1>
        {subtitle ? <p className={classes.subtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={classes.toolbarActions}>{actions}</div> : null}
    </div>
  );
}
