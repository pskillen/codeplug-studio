import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../v2/index.ts';
import classes from './RadioIoPanelCards.module.css';

export interface DangerZoneCardProps {
  buildId: string;
}

/**
 * Last card of the AT-D890 Export panel: a collapsed, red-edged disclosure that links to the Danger zone area.
 * The panel renders it only when a tool is offered on this deploy.
 */
export default function DangerZoneCard({ buildId }: DangerZoneCardProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <section className={classes.dangerCard} aria-label="Danger zone">
      <button
        type="button"
        className={classes.dangerToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={classes.cardTitle}>Danger zone</span>
        <span className={classes.line}> · Changes the radio itself</span>
      </button>
      {open ? (
        <>
          <p className={classes.line}>
            Rare jobs that change the radio, not your codeplug. Each one backs up first.
          </p>
          <div className={classes.actions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/builds/${buildId}/export/danger-zone`)}
            >
              Open danger zone
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
