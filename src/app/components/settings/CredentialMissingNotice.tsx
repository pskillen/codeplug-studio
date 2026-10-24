import { Link } from 'react-router-dom';
import type { CredentialGuide } from '../../lib/credentialGuides.tsx';
import { StatusBanner } from '../v2/index.ts';
import classes from './CredentialMissingNotice.module.css';

export interface CredentialMissingNoticeProps {
  guide: CredentialGuide;
  /** What the operator was trying to do, e.g. "Searching RepeaterBook". */
  action: string;
  /** `banner` for page-level warnings; `inline` for a quiet line inside a panel. */
  variant?: 'banner' | 'inline';
}

/**
 * Point-of-use prompt when a feature needs a bring-your-own key that is not
 * saved yet. Explains what is needed and links to the Settings section and
 * the provider page.
 */
export default function CredentialMissingNotice({
  guide,
  action,
  variant = 'banner',
}: CredentialMissingNoticeProps) {
  const body = (
    <>
      <strong>
        {action} needs your own {guide.service} {guide.noun}.
      </strong>{' '}
      {guide.cost}{' '}
      <Link to="/settings" state={{ scrollTo: guide.sectionId }} className={classes.link}>
        Set it up in Settings
      </Link>{' '}
      (step-by-step instructions there), or{' '}
      <a href={guide.getUrl} target="_blank" rel="noreferrer" className={classes.link}>
        go to {guide.service}
      </a>
      .
    </>
  );

  if (variant === 'inline') {
    return <p className={classes.inline}>{body}</p>;
  }
  return <StatusBanner tone="warning">{body}</StatusBanner>;
}
