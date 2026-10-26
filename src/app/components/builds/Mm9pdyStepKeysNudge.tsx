/**
 * MM9PDY step-key nudge (#1393): on the MM9PDY target, after a read, when P1 / P2 short press
 * aren't TG next / TG previous, offer to set them. A different layout is a valid choice, so
 * nothing is shown when the keys already match, and nothing on the stock target.
 */

import {
  MM9PDY_TG_NEXT_FUNCTION,
  MM9PDY_TG_PREVIOUS_FUNCTION,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { AtD890SettingsTargetId } from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import { Button, StatusBanner } from '../v2/index.ts';
import classes from './Mm9pdyStepKeysNudge.module.css';

export interface Mm9pdyStepKeysNudgeProps {
  target: AtD890SettingsTargetId;
  /** True once a radio has been read; the nudge is about what the radio holds. */
  hasRead: boolean;
  /** P1 and P2 short-press functions the read found (`undefined` when not offered). */
  readP1: number | undefined;
  readP2: number | undefined;
  /** Session overrides for the same two fields, when set. */
  overrideP1?: unknown;
  overrideP2?: unknown;
  /** Set the two ordinary session overrides. */
  onUse: () => void;
}

function matches(p1: number | undefined, p2: number | undefined): boolean {
  return p1 === MM9PDY_TG_NEXT_FUNCTION && p2 === MM9PDY_TG_PREVIOUS_FUNCTION;
}

export default function Mm9pdyStepKeysNudge({
  target,
  hasRead,
  readP1,
  readP2,
  overrideP1,
  overrideP2,
  onUse,
}: Mm9pdyStepKeysNudgeProps) {
  if (target !== 'mm9pdy' || !hasRead) return null;
  if (matches(readP1, readP2)) return null;
  // The user has already chosen for these keys this session (the nudge's own button, or a layout
  // of their own): a different layout is a valid choice, so stop asking.
  if (overrideP1 !== undefined || overrideP2 !== undefined) return null;
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
