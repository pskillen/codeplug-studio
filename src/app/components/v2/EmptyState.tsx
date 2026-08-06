import { IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Reduces vertical padding for denser contexts (e.g. embedded pool sections). Default `false`. */
  compact?: boolean;
  className?: string;
}

/**
 * Design-system-v2 empty state: icon badge, title, description, optional
 * action. A new independent component — v1 `ui/EmptyState.tsx` (message-only,
 * no title/description split) stays as-is and is not replaced by this.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={[classes.root, compact ? classes.compact : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={classes.iconBadge} aria-hidden>
        {icon ?? <IconInbox size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
      </div>
      <div className={classes.title}>{title}</div>
      {description ? <div className={classes.description}>{description}</div> : null}
      {action ? <div className={classes.action}>{action}</div> : null}
    </div>
  );
}
