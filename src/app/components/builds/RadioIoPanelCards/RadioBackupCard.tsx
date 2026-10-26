import { Link, useNavigate } from 'react-router-dom';
import { Anchor } from '@mantine/core';
import { useBackupsThisSession } from '../../../state/radioSessionBackups.ts';
import { Button } from '../../v2/index.ts';
import classes from './RadioIoPanelCards.module.css';

export interface RadioBackupCardProps {
  buildId: string;
}

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Radios with backup support: the last backup this session, Back up a radio, and the page link. */
export default function RadioBackupCard({ buildId }: RadioBackupCardProps) {
  const navigate = useNavigate();
  const backups = useBackupsThisSession(buildId);
  const last = backups.at(-1);
  const line = last
    ? `Last backup this session: ${timeOf(last.at)} (${last.name || last.serial || 'radio'})`
    : 'No backups this session';
  const backupPath = `/builds/${buildId}/backup`;
  return (
    <section className={classes.card} aria-label="Backup">
      <h3 className={classes.cardTitle}>Backup</h3>
      <p className={classes.line}>{line}</p>
      <div className={classes.actions}>
        <Button variant="secondary" size="sm" onClick={() => navigate(backupPath)}>
          Back up a radio
        </Button>
        <Anchor component={Link} to={backupPath} size="sm">
          Backup / Restore
        </Anchor>
      </div>
    </section>
  );
}
