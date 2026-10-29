import type { ReactNode } from 'react';
import { IconExternalLink } from '@tabler/icons-react';
import classes from './ContextualStrip.module.css';

/** A strip tab: a bare label, or a label with an icon and an external-link marker. */
export type ContextualStripEntry =
  | string
  | {
      label: string;
      icon?: ReactNode;
      /** Shows an external-link marker after the label. */
      external?: boolean;
    };

export interface ContextualStripProps {
  items: readonly ContextualStripEntry[];
  active?: string;
  onChange?: (item: string) => void;
  /** Controls before section tabs (e.g. build switcher chip). */
  leading?: ReactNode;
  /** Section name shown before the tabs (e.g. "Tools") when there is no `leading` control. */
  sectionLabel?: { label: string; icon?: ReactNode };
  className?: string;
}

/**
 * Section sub-view tab strip, typically directly under `AppShell`.
 */
export default function ContextualStrip({
  items,
  active,
  onChange,
  leading,
  sectionLabel,
  className,
}: ContextualStripProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')} role="tablist">
      {leading ? (
        <>
          <div className={classes.leading}>{leading}</div>
          <div className={classes.divider} aria-hidden />
        </>
      ) : sectionLabel ? (
        <div className={classes.sectionLabel} aria-hidden>
          {sectionLabel.icon}
          {sectionLabel.label}
        </div>
      ) : null}
      {items.map((entry) => {
        const item = typeof entry === 'string' ? { label: entry } : entry;
        const isActive = item.label === active;
        return (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={[classes.item, isActive ? classes.active : ''].filter(Boolean).join(' ')}
            onClick={() => onChange?.(item.label)}
          >
            {item.icon ? <span className={classes.icon}>{item.icon}</span> : null}
            {item.label}
            {item.external ? (
              <IconExternalLink size={12} stroke={2} className={classes.external} aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
