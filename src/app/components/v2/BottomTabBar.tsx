import type { ReactNode } from 'react';
import classes from './BottomTabBar.module.css';

export interface BottomTabItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** Optional count badge. */
  badge?: number | string;
}

export interface BottomTabBarProps {
  items: readonly BottomTabItem[];
  activeId: string;
  onChange?: (id: string) => void;
  className?: string;
}

/**
 * Mobile bottom tab bar. Presentational / fixture-driven in #916; real route
 * wiring lands in the chrome port (#917).
 */
export default function BottomTabBar({ items, activeId, onChange, className }: BottomTabBarProps) {
  return (
    <nav className={[classes.root, className].filter(Boolean).join(' ')} aria-label="Primary">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            className={[classes.tab, active ? classes.active : ''].filter(Boolean).join(' ')}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange?.(item.id)}
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
