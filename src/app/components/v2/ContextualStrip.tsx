import type { ReactNode } from 'react';
import classes from './ContextualStrip.module.css';

export interface ContextualStripProps {
  items: readonly string[];
  active?: string;
  onChange?: (item: string) => void;
  /** Controls after section tabs (e.g. build switcher chip). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Section sub-view pill strip, typically directly under `AppShell`.
 */
export default function ContextualStrip({
  items,
  active,
  onChange,
  trailing,
  className,
}: ContextualStripProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')} role="tablist">
      {items.map((item) => {
        const isActive = item === active;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={[classes.item, isActive ? classes.active : ''].filter(Boolean).join(' ')}
            onClick={() => onChange?.(item)}
          >
            {item}
          </button>
        );
      })}
      {trailing ? (
        <>
          <div className={classes.divider} aria-hidden />
          <div className={classes.trailing}>{trailing}</div>
        </>
      ) : null}
    </div>
  );
}
