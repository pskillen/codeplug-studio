import { IconArrowLeft } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import classes from './EditorHeader.module.css';

export interface EditorHeaderProps {
  /** Breadcrumb label (e.g. "Channels"). */
  crumb: string;
  /** When set, crumb renders as a router link. */
  crumbTo?: string;
  /** When set without `crumbTo`, crumb is a button. */
  onCrumbClick?: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  compact?: boolean;
  className?: string;
}

/**
 * Editor page title block with back crumb — Batch 3 E1–E8 chrome.
 */
export default function EditorHeader({
  crumb,
  crumbTo,
  onCrumbClick,
  title,
  subtitle,
  compact = false,
  className,
}: EditorHeaderProps) {
  const crumbContent = (
    <>
      <IconArrowLeft size={13} stroke={2} aria-hidden className={classes.crumbIcon} />
      <span>{crumb}</span>
    </>
  );

  return (
    <header
      className={[classes.root, compact ? classes.compact : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={classes.crumbRow}>
        {crumbTo ? (
          <Link to={crumbTo} className={classes.crumb}>
            {crumbContent}
          </Link>
        ) : onCrumbClick ? (
          <button type="button" className={classes.crumbButton} onClick={onCrumbClick}>
            {crumbContent}
          </button>
        ) : (
          <span className={classes.crumbStatic}>{crumbContent}</span>
        )}
      </div>
      <div className={classes.titles}>
        <h1 className={classes.title}>{title}</h1>
        {subtitle != null && subtitle !== '' ? (
          <p className={classes.subtitle}>{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
