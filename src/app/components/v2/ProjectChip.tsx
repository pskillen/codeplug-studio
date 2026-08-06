import { IconChevronDown } from '@tabler/icons-react';
import { forwardRef } from 'react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import type { StatusDotTone } from './StatusDot.tsx';
import classes from './ProjectChip.module.css';

export interface ProjectChipProps {
  name: string;
  statusTone?: StatusDotTone;
  /** Shown after the name when set (e.g. Unsaved changes). */
  statusLabel?: string | null;
  /** Mobile: dot + chevron only. */
  compact?: boolean;
  onClick?: () => void;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid';
  className?: string;
}

const DOT_CLASS: Record<StatusDotTone, string> = {
  success: classes.dotSuccess,
  warning: classes.dotWarning,
  accent: classes.dotAccent,
  neutral: classes.dotNeutral,
  destructive: classes.dotWarning,
};

/**
 * mk2 S2 combined project identity chip — name, calm status dot/label, chevron for S3.
 */
export default forwardRef<HTMLButtonElement, ProjectChipProps>(function ProjectChip(
  {
    name,
    statusTone = 'success',
    statusLabel = null,
    compact = false,
    onClick,
    className,
    ...aria
  },
  ref,
) {
  const content = (
    <>
      <span className={[classes.dot, DOT_CLASS[statusTone]].join(' ')} aria-hidden />
      {compact ? null : (
        <>
          <span className={classes.name}>{name}</span>
          {statusLabel ? (
            <>
              <span className={classes.separator} aria-hidden>
                ·
              </span>
              <span className={classes.statusLabel}>{statusLabel}</span>
            </>
          ) : null}
        </>
      )}
      <IconChevronDown size={ICON_SIZE_NAV} stroke={ICON_STROKE} className={classes.chevron} />
    </>
  );

  const classNames = [classes.chip, compact ? classes.chipCompact : '', className]
    .filter(Boolean)
    .join(' ');

  const accessibleName = statusLabel ? `${name}, ${statusLabel}` : name;

  if (onClick) {
    return (
      <button
        ref={ref}
        type="button"
        className={classNames}
        onClick={onClick}
        aria-label={compact ? accessibleName : undefined}
        {...aria}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={classNames} {...aria}>
      {content}
    </div>
  );
});
