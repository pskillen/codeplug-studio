import type { ReactNode } from 'react';
import classes from './Panel.module.css';

export interface PanelProps {
  /** Anchor target id for SectionNav scroll spy. */
  id?: string;
  title?: string;
  /** Optional description below the title. */
  sub?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Bordered content panel with optional titled header — editor sections and summary breakdowns.
 */
export default function Panel({ id, title, sub, children, className }: PanelProps) {
  const hasHeader = title != null;

  return (
    <section id={id} className={[classes.root, className].filter(Boolean).join(' ')}>
      {hasHeader ? (
        <h2 className={[classes.title, sub ? classes.titleWithSub : ''].filter(Boolean).join(' ')}>
          {title}
        </h2>
      ) : null}
      {sub ? <p className={classes.sub}>{sub}</p> : null}
      {children ? <div className={classes.body}>{children}</div> : null}
    </section>
  );
}
