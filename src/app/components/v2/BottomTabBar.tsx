import type { ReactNode } from 'react';
import classes from './BottomTabBar.module.css';

export interface BottomTabItem {
  /** Stable id for selection (preferred). */
  id?: string;
  label: string;
  icon: ReactNode;
  badge?: number | string;
}

export interface BottomTabBarProps {
  items: readonly BottomTabItem[];
  /** Active item id, or label when ids are omitted (design-system API). */
  active?: string;
  activeId?: string;
  onChange?: (idOrLabel: string) => void;
  className?: string;
}

/**
 * Mobile bottom tab bar. Presentational / fixture-driven in #916; real route
 * wiring lands in the chrome port (#917).
 */
export default function BottomTabBar({
  items,
  active,
  activeId,
  onChange,
  className,
}: BottomTabBarProps) {
  const current = activeId ?? active;

  return (
    <nav className={[classes.root, className].filter(Boolean).join(' ')} aria-label="Primary">
      {items.map((item) => {
        const key = item.id ?? item.label;
        const isActive = current === key || current === item.label;
        return (
          <button
            key={key}
            type="button"
            className={[classes.tab, isActive ? classes.active : ''].filter(Boolean).join(' ')}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange?.(key)}
          >
            <span className={classes.icon} aria-hidden>
              {item.icon}
            </span>
            <span className={classes.label}>{item.label}</span>
            {item.badge != null ? <span className={classes.badge}>{item.badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
