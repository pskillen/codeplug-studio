/**
 * When the RT95 Review must stop for the user (#1638): one reason per choice or warning
 * `Rt95ReviewSections` would show. The channel-signalling note (shown on every RT95 codeplug
 * Write), the settings now → after list, the backup reminder and the zone counts are facts, not
 * reasons. The section's "back up before changing advanced settings" advice is one, but only when
 * an advanced field (power-on password, remote stun/kill) actually changes and no backup is held.
 */

import { getRt95RadioSettingsSession } from '../../../../state/rt95RadioSettingsSession.ts';
import type { ReviewContext, ReviewPauseReason } from '../reviewSections.tsx';
import { rt95SettingChanges } from './rt95ReviewFacts.ts';

export function rt95ReviewPauseReasons(ctx: ReviewContext): ReviewPauseReason[] {
  const rt95 = ctx.rt95;
  if (!rt95) return [];
  const reasons: ReviewPauseReason[] = [];
  const settings = rt95.settings;
  if (settings) {
    const state = settings.getState();
    if (!settings.canWrite()) reasons.push('nothing-to-write');
    // Not the radio the settings were read from (by band limit): Apply or Keep is the user's call.
    if (state.settingsTicked && !settings.init.sameRadio) reasons.push('settings-choice');
    if (state.settingsTicked && state.choice === 'apply' && state.backup.status !== 'saved') {
      const store = getRt95RadioSettingsSession(settings.init.buildId);
      const overrides = [...store.overrides].map(([fieldId, value]) => ({ fieldId, value }));
      const changes = rt95SettingChanges(settings.init.snapshot, settings.init.target, overrides);
      if (changes.some((c) => c.advanced)) reasons.push('advanced-settings-no-backup');
    }
  }
  const modData = rt95.modData;
  if (modData && modData.zones > 0 && !modData.zoneKey) reasons.push('zone-key-nudge');
  return reasons;
}
