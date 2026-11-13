/**
 * When the MM9PDY step-key nudge shows (#1393): on the MM9PDY target, after a read, when P1 / P2
 * short press aren't TG next / TG previous and the user has not chosen for them this session.
 * Shared by the nudge and the Write stepper's Review pause (#1638).
 */

import {
  MM9PDY_TG_NEXT_FUNCTION,
  MM9PDY_TG_PREVIOUS_FUNCTION,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { AtD890SettingsTargetId } from '@core/radios/anytone/at-d890uv/radioSettings.ts';

export interface Mm9pdyStepKeysFacts {
  target: AtD890SettingsTargetId;
  /** True once a radio has been read; the nudge is about what the radio holds. */
  hasRead: boolean;
  /** P1 and P2 short-press functions the read found (`undefined` when not offered). */
  readP1: number | undefined;
  readP2: number | undefined;
  /** Session overrides for the same two fields, when set. */
  overrideP1?: unknown;
  overrideP2?: unknown;
}

export function mm9pdyStepKeysNudgeShown(f: Mm9pdyStepKeysFacts): boolean {
  if (f.target !== 'mm9pdy' || !f.hasRead) return false;
  if (f.readP1 === MM9PDY_TG_NEXT_FUNCTION && f.readP2 === MM9PDY_TG_PREVIOUS_FUNCTION) {
    return false;
  }
  // The user has already chosen for these keys this session (the nudge's own button, or a layout
  // of their own): a different layout is a valid choice, so stop asking.
  return f.overrideP1 === undefined && f.overrideP2 === undefined;
}
