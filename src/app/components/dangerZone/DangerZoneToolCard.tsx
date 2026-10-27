import type { DangerZoneToolDescriptor } from '../../services/dangerZone/registry.ts';
import { Button } from '../v2/index.ts';
import classes from './DangerZoneToolCard.module.css';

export interface DangerZoneToolCardProps {
  tool: Pick<DangerZoneToolDescriptor, 'id' | 'title' | 'summary' | 'cost' | 'minutes'>;
  /** Opens the tool's wizard. Omit while the tool has no wizard: the card then shows no button. */
  onStart?: () => void;
}

/** One tool on the Danger zone area: what it does, what it costs, how long, and an optional Start…. */
export default function DangerZoneToolCard({ tool, onStart }: DangerZoneToolCardProps) {
  return (
    <section className={classes.card} aria-labelledby={`danger-zone-tool-${tool.id}`}>
      <h2 className={classes.title} id={`danger-zone-tool-${tool.id}`}>
        {tool.title}
      </h2>
      <p className={classes.body}>
        {tool.summary} {tool.cost} About {tool.minutes} minutes. You&apos;ll save two backup files.
      </p>
      {onStart ? (
        <div className={classes.actions}>
          <Button variant="secondary" size="sm" className={classes.start} onClick={onStart}>
            Start…
          </Button>
        </div>
      ) : null}
    </section>
  );
}
