/**
 * When the AT-D890UV Review must stop for the user (#1638): one reason per warning, refusal or
 * choice `AtD890ReviewSections` would show. Facts (the frequency range, the settings the user
 * chose, the NXDN ID line) and offers (Save backup) are not reasons. Pure apart from reading the
 * session settings store, as the sections do.
 */

import { getAtD890RadioSettingsSession } from '../../../../state/atD890RadioSettingsSession.ts';
import { mm9pdyStepKeysNudgeShown } from '../../mm9pdyStepKeysNudgeShown.ts';
import type { ReviewContext, ReviewPauseReason } from '../reviewSections.tsx';
import { atD890ReviewRepeaterAdvice } from './atD890ReviewFacts.ts';

export function atD890ReviewPauseReasons(ctx: ReviewContext): ReviewPauseReason[] {
  const controller = ctx.atD890;
  if (!controller) return [];
  const init = controller.init;
  const state = controller.getState();
  const store = getAtD890RadioSettingsSession(init.buildId);
  const reasons: ReviewPauseReason[] = [];
  if (!controller.canWrite()) reasons.push('nothing-to-write');
  // Both sections show only for a codeplug Write: a contacts-only Write has nothing to warn about.
  if (ctx.parts.codeplug && init.receiveOnly.length > 0) reasons.push('receive-only-channels');
  if (ctx.parts.codeplug && init.masterIdSelected && !init.settingsOnly) {
    reasons.push('master-id-on');
  }
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  if (
    mm9pdyStepKeysNudgeShown({
      target: init.target,
      hasRead: true,
      readP1: num(init.decoded.keyShortP1?.value),
      readP2: num(init.decoded.keyShortP2?.value),
      overrideP1: store.overrides.get('keyShortP1'),
      overrideP2: store.overrides.get('keyShortP2'),
    })
  ) {
    reasons.push('step-keys-nudge');
  }
  if (state.settingsTicked) {
    if (controller.blockReason()) reasons.push('settings-blocked');
    const overrides = [...store.overrides].map(([fieldId, value]) => ({ fieldId, value }));
    const advice = atD890ReviewRepeaterAdvice(
      init.snapshot,
      init.decoded,
      overrides,
      state.choice === 'apply',
    );
    if (advice?.caution) reasons.push('repeater-mode-caution');
    // Another radio (or no settings read): Apply or Keep is the user's call, unless they chose
    // "Don't ask again for other radios until I reload".
    if (!init.sameRadio && !init.applyToEveryRadio) reasons.push('settings-choice');
  }
  return reasons;
}
