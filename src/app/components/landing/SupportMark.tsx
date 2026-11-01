import type { SupportState } from '@core/radio-targets/index.ts';
import { SUPPORT_STATE_LABEL } from './supportLabels.ts';
import classes from './landing.module.css';

const GLYPH: Record<SupportState, string> = {
  supported: '✓',
  // `◐` falls back to a tiny dot in common system fonts; `~` reads at any size.
  partial: '~',
  unsupported: '✕',
  na: '–',
};

/** Tick / tilde / cross / dash mark for one support state. Text label is exposed to screen readers. */
export default function SupportMark({ state }: { state: SupportState }) {
  return (
    <span
      className={`${classes.mark} ${classes[`mark_${state}`]}`}
      title={SUPPORT_STATE_LABEL[state]}
    >
      <span aria-hidden="true">{GLYPH[state]}</span>
      <span className={classes.srOnly}>{SUPPORT_STATE_LABEL[state]}</span>
    </span>
  );
}
