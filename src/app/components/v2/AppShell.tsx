import type { ReactNode } from 'react';
import ProjectChip from './ProjectChip.tsx';
import type { StatusDotTone } from './StatusDot.tsx';
import classes from './AppShell.module.css';

const LOGO_SRC = '/branding/studio-logo.svg';

export interface AppShellProps {
  /** Top-level section tabs (e.g. Summary / Library / Tools / Export for radio / Help). */
  tabs?: readonly string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  /** Tab labels that should render disabled (e.g. project-scoped tabs with no project). */
  disabledTabs?: readonly string[];
  /** When false, hide the desktop tab row (mobile uses BottomTabBar instead). Default true. */
  showTabs?: boolean;
  /** When set, replaces the built-in project chip (e.g. S3 switcher wrapper). */
  projectChip?: ReactNode;
  projectName?: string;
  /** mk2 S2 status dot tone on the project chip. */
  projectStatusTone?: StatusDotTone;
  /** mk2 S2 secondary label (e.g. Unsaved changes); omit when quiet. */
  projectStatusLabel?: string | null;
  /** Mobile: compact chip (dot + chevron only). */
  compactProjectChip?: boolean;
  /** Clicking the project chip (opens quick switcher or navigate home). */
  onProjectClick?: () => void;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid';
  /** Clicking the brand logo (typically navigate home). */
  onBrandClick?: () => void;
  /** Injected before the avatar slot (Drive controls). */
  rightExtra?: ReactNode;
  /** Replaces the default avatar square (overflow menu target). */
  avatar?: ReactNode;
  className?: string;
}

/**
 * Design-system primary header: brand logo, top tabs, project chip, avatar slot.
 * Pair with `ContextualStrip` below for section sub-views.
 */
export default function AppShell({
  tabs = [],
  activeTab,
  onTabChange,
  disabledTabs = [],
  showTabs = true,
  projectChip,
  projectName = 'Untitled project',
  projectStatusTone = 'success',
  projectStatusLabel = null,
  compactProjectChip = false,
  onProjectClick,
  onBrandClick,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHaspopup,
  rightExtra,
  avatar,
  className,
}: AppShellProps) {
  const disabled = new Set(disabledTabs);

  const logo = (
    <img src={LOGO_SRC} alt={onBrandClick ? '' : 'Codeplug Studio'} className={classes.logo} />
  );

  return (
    <header className={[classes.root, className].filter(Boolean).join(' ')}>
      {onBrandClick ? (
        <button
          type="button"
          className={classes.brand}
          onClick={onBrandClick}
          aria-label="Codeplug Studio home"
        >
          {logo}
        </button>
      ) : (
        <div className={classes.brand}>{logo}</div>
      )}

      {showTabs ? (
        <nav className={classes.tabs} aria-label="Primary">
          {tabs.map((tab) => {
            const active = tab === activeTab;
            const isDisabled = disabled.has(tab);
            return (
              <button
                key={tab}
                type="button"
                className={[
                  classes.tab,
                  active ? classes.tabActive : '',
                  isDisabled ? classes.tabDisabled : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={active ? 'page' : undefined}
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) onTabChange?.(tab);
                }}
              >
                {tab}
              </button>
            );
          })}
        </nav>
      ) : null}

      <div className={classes.right}>
        {projectChip ??
          (onProjectClick ? (
            <ProjectChip
              name={projectName}
              statusTone={projectStatusTone}
              statusLabel={projectStatusLabel}
              compact={compactProjectChip}
              onClick={onProjectClick}
              aria-expanded={ariaExpanded}
              aria-haspopup={ariaHaspopup}
            />
          ) : (
            <ProjectChip
              name={projectName}
              statusTone={projectStatusTone}
              statusLabel={projectStatusLabel}
              compact={compactProjectChip}
            />
          ))}
        {rightExtra}
        {avatar ?? <div className={classes.avatar} aria-hidden />}
      </div>
    </header>
  );
}
