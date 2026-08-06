import type { ReactNode } from 'react';
import classes from './ContextualStrip.module.css';

export interface ContextualStripProps {
  items: readonly string[];
  active?: string;
  onChange?: (item: string) => void;
  /** Controls before section tabs (e.g. build switcher chip). */
  leading?: ReactNode;
  className?: string;
}

/**
 * Section sub-view pill strip, typically directly under `AppShell`.
 */
export default function ContextualStrip({
  items,
  active,
  onChange,
  leading,
  className,
}: ContextualStripProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')} role="tablist">
      {leading ? (
        <>
          <div className={classes.leading}>{leading}</div>
          <div className={classes.divider} aria-hidden />
        </>
      ) : null}
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
    </div>
  );
}
