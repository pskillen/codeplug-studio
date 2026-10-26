import type { RadioToolDescriptor } from '../../services/radioTools/registry.ts';
import { Button } from '../v2/index.ts';
import classes from './RadioToolCard.module.css';

export interface RadioToolCardProps {
  tool: Pick<RadioToolDescriptor, 'id' | 'title' | 'summary' | 'cost' | 'minutes'>;
  /** Opens the tool's wizard. Omit while the tool has no wizard: the card then shows no button. */
  onStart?: () => void;
}

/** One tool on the Radio tools area: what it does, what it costs, how long, and an optional Start…. */
export default function RadioToolCard({ tool, onStart }: RadioToolCardProps) {
  return (
    <section className={classes.card} aria-labelledby={`radio-tool-${tool.id}`}>
      <h2 className={classes.title} id={`radio-tool-${tool.id}`}>
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
