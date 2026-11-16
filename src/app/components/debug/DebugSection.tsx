import { useState, type ReactNode } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './DebugSection.module.css';

export interface DebugSectionProps {
  /** Anchor id for jump links. */
  id?: string;
  title: string;
  /** One dimmed paragraph under the title. */
  description?: ReactNode;
  /** Right of the title: address range, confidence badge, diff badge. */
  meta?: ReactNode;
  /** The title becomes a disclosure toggle that shows or hides the body. */
  collapsible?: boolean;
  /** Initial state when `collapsible` is set. */
  defaultCollapsed?: boolean;
  children?: ReactNode;
  className?: string;
}

/** Titled bordered container for every block on a debug tab. Radio-neutral. */
export default function DebugSection({
  id,
  title,
  description,
  meta,
  collapsible = false,
  defaultCollapsed = false,
  children,
  className,
}: DebugSectionProps) {
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);
  const showBody = !collapsible || !collapsed;
  return (
    <section id={id} className={[classes.root, className].filter(Boolean).join(' ')}>
      <div className={classes.header}>
        <h2 className={classes.title}>
          {collapsible ? (
            <button
              type="button"
              className={classes.toggle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((c) => !c)}
            >
              <span>{title}</span>
              <IconChevronDown
                size={ICON_SIZE_NAV}
                stroke={ICON_STROKE}
                aria-hidden
                className={[classes.chevron, collapsed ? classes.chevronCollapsed : '']
                  .filter(Boolean)
                  .join(' ')}
              />
            </button>
          ) : (
            title
          )}
        </h2>
        {meta ? <div className={classes.meta}>{meta}</div> : null}
      </div>
      {description ? <p className={classes.description}>{description}</p> : null}
      {children && showBody ? <div className={classes.body}>{children}</div> : null}
    </section>
  );
}
