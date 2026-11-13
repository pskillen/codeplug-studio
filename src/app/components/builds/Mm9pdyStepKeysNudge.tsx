/**
 * MM9PDY step-key nudge (#1393): on the MM9PDY target, after a read, when P1 / P2 short press
 * aren't TG next / TG previous, offer to set them. A different layout is a valid choice, so
 * nothing is shown when the keys already match, and nothing on the stock target.
 */

import { Button, StatusBanner } from '../v2/index.ts';
import classes from './Mm9pdyStepKeysNudge.module.css';
import { mm9pdyStepKeysNudgeShown, type Mm9pdyStepKeysFacts } from './mm9pdyStepKeysNudgeShown.ts';

export interface Mm9pdyStepKeysNudgeProps extends Mm9pdyStepKeysFacts {
  /** Set the two ordinary session overrides. */
  onUse: () => void;
}

export default function Mm9pdyStepKeysNudge({ onUse, ...facts }: Mm9pdyStepKeysNudgeProps) {
  if (!mm9pdyStepKeysNudgeShown(facts)) return null;
  return (
    <div className={classes.nudge} data-testid="mm9pdy-step-keys-nudge">
      <StatusBanner tone="info">
        Your P1/P2 keys aren&apos;t set to TG previous / next.
      </StatusBanner>
      <Button variant="outline" size="sm" onClick={onUse}>
        Use MM9PDY step keys
      </Button>
    </div>
  );
}
