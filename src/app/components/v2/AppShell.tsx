import type { ReactNode } from 'react';
import classes from './AppShell.module.css';

export interface AppShellProps {
  /** Top-level section tabs (e.g. Summary / Library / Tools / Export for radio). */
  tabs?: readonly string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  projectName?: string;
  /** Injected before the avatar slot (Help / Settings links). */
  rightExtra?: ReactNode;
  className?: string;
}

/**
 * Design-system primary header: wordmark, top tabs, project chip, avatar slot.
 * Pair with `ContextualStrip` below for section sub-views. Not wired to real
 * routes in #916 (#917).
 */
export default function AppShell({
  tabs = [],
  activeTab,
  onTabChange,
  projectName = 'Untitled project',
  rightExtra,
  className,
}: AppShellProps) {
  return (
    <header className={[classes.root, className].filter(Boolean).join(' ')}>
      <div className={classes.brand}>
        <div className={classes.mark} aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className={classes.wordmark}>Codeplug Studio</div>
      </div>

      <nav className={classes.tabs} aria-label="Primary">
        {tabs.map((tab) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              className={[classes.tab, active ? classes.tabActive : ''].filter(Boolean).join(' ')}
              aria-current={active ? 'page' : undefined}
              onClick={() => onTabChange?.(tab)}
            >
              {tab}
            </button>
          );
        })}
      </nav>

      <div className={classes.right}>
        <div className={classes.project}>
          <span className={classes.projectDot} aria-hidden />
          {projectName}
        </div>
        {rightExtra}
        <div className={classes.avatar} aria-hidden />
      </div>
    </header>
  );
}
