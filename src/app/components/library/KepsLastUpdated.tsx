import { Link } from 'react-router-dom';
import { Anchor } from '@mantine/core';
import { formatKepsLastUpdated } from '../../lib/kepsLastUpdated.ts';
import classes from './KepsLastUpdated.module.css';

export interface KepsLastUpdatedProps {
  /** `ProjectMeta.satelliteLibraryLastUpdated` — not TLE epoch or row updatedAt. */
  iso: string | null | undefined;
  /** When set, appends a link to Library → Satellite Keps to refresh keps. */
  libraryHref?: string;
}

export default function KepsLastUpdated({ iso, libraryHref }: KepsLastUpdatedProps) {
  const { label, stale } = formatKepsLastUpdated(iso);

  return (
    <span className={stale ? classes.lastUpdatedStale : classes.lastUpdated}>
      {label}
      {libraryHref ? (
        <>
          {' · '}
          <Anchor component={Link} to={libraryHref} size="xs" className={classes.libraryLink}>
            Update in Library
          </Anchor>
        </>
      ) : null}
    </span>
  );
}
