import { useState, type ReactNode } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './Panel.module.css';

export interface PanelProps {
  /** Anchor target id for SectionNav scroll spy. */
  id?: string;
  title?: string;
  /** Optional description below the title. */
  sub?: string;
  children?: ReactNode;
  className?: string;
  /** `danger` — destructive tint for irreversible actions (e.g. delete build). */
  variant?: 'default' | 'danger';
  /** When true, the title becomes a toggle that shows/hides the body — requires `title`. */
  collapsible?: boolean;
  /** Initial state when `collapsible` is set. Defaults to expanded. */
  defaultCollapsed?: boolean;
}

/**
 * Bordered content panel with optional titled header — editor sections and summary breakdowns.
 * Set `collapsible` (+ optionally `defaultCollapsed`) for a disclosure header, e.g. to default a
 * long section closed on narrow viewports.
 */
export default function Panel({
  id,
  title,
  sub,
  children,
  className,
  variant = 'default',
  collapsible = false,
  defaultCollapsed = false,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);
  const hasHeader = title != null;
  const showBody = !collapsible || !collapsed;

  return (
    <section
      id={id}
      className={[classes.root, variant === 'danger' ? classes.danger : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {hasHeader ? (
        <h2 className={[classes.title, sub ? classes.titleWithSub : ''].filter(Boolean).join(' ')}>
          {collapsible ? (
            <button
              type="button"
              className={classes.collapseToggle}
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
            >
              <span>{title}</span>
              <IconChevronDown
                size={ICON_SIZE_NAV}
                stroke={ICON_STROKE}
                className={[classes.chevron, collapsed ? classes.chevronCollapsed : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden
              />
            </button>
          ) : (
            title
          )}
        </h2>
      ) : null}
      {sub ? <p className={classes.sub}>{sub}</p> : null}
      {children && showBody ? <div className={classes.body}>{children}</div> : null}
    </section>
  );
}
