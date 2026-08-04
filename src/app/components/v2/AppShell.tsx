import type { ReactNode } from 'react';
import classes from './AppShell.module.css';

export interface AppShellProps {
  /** Brand / project strip across the top. */
  header?: ReactNode;
  /** Desktop side navigation (hidden visually on narrow demos via CSS). */
  nav?: ReactNode;
  /** Optional contextual strip under the header (section title, actions). */
  contextualStrip?: ReactNode;
  /** Main page content. */
  children: ReactNode;
  /** Mobile bottom tabs — typically a `BottomTabBar`. */
  bottomBar?: ReactNode;
  className?: string;
}

/**
 * Presentational app chrome for design-system v2. Fixture-driven only in #916 —
 * not wired to real routes (that's #917).
 */
export default function AppShell({
  header,
  nav,
  contextualStrip,
  children,
  bottomBar,
  className,
}: AppShellProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      {header ? <header className={classes.header}>{header}</header> : null}
      <div className={classes.body}>
        {nav ? <aside className={classes.nav}>{nav}</aside> : null}
        <div className={classes.mainColumn}>
          {contextualStrip ? <div className={classes.contextual}>{contextualStrip}</div> : null}
          <main className={classes.main}>{children}</main>
        </div>
      </div>
      {bottomBar ? <div className={classes.bottomBar}>{bottomBar}</div> : null}
    </div>
  );
}
