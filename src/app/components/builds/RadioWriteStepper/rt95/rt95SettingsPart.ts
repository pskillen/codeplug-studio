/**
 * RT95 Radio settings part: session store, settings-only write, Review controller (#1963).
 */

import { isRt95RadioIoProfileId } from '@core/import-export/formatProfiles.ts';
import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import type { Rt95PreTransmitResult } from '../../../../services/radioIoSession.ts';
import { rt95SettingsReadFromSnapshot } from '../../../../services/radioIoRt95SettingsRead.ts';
import { writeRt95SettingsOnly } from '../../../../services/radioIoRt95SettingsWrite.ts';
import {
  getRt95RadioSettingsSession,
  overridesForWrite as rt95OverridesForWrite,
  setRead as setRt95Read,
} from '../../../../state/rt95RadioSettingsSession.ts';
import { findBackupForSerial } from '../../../../state/radioSessionBackups.ts';
import {
  type RadioSettingsPart,
  type RadioSettingsPartDeps,
  type SettingsReviewController,
} from '../../../../services/egress/radioSettingsParts.ts';
import { writesToRadioImage, type WriteParts } from '../writeParts.ts';
import {
  createRt95ReviewController,
  defaultRt95SettingsChoice,
  isRt95SettingsReadRadio,
  type Rt95ReviewController,
} from './rt95ReviewController.ts';
import { rt95SettingChanges } from './rt95ReviewFacts.ts';

function settingsWillBeWritten(controller: SettingsReviewController, buildId: string): boolean {
  const state = controller.getState();
  const overrides = rt95OverridesForWrite(buildId);
  return state.settingsTicked && state.choice === 'apply' && overrides.length > 0;
}

function buildController(
  rtCtx: import('../../../../services/radioIoSession.ts').Rt95PreTransmitContext,
  p: WriteParts,
  deps: RadioSettingsPartDeps,
): Rt95ReviewController {
  const store = getRt95RadioSettingsSession(deps.buildId);
  const sameRadio = isRt95SettingsReadRadio(store.read?.bandlimit, rtCtx.bandlimit);
  const existing = findBackupForSerial(deps.buildId, String(rtCtx.bandlimit));
  return createRt95ReviewController({
    buildId: deps.buildId,
    bandlimit: rtCtx.bandlimit,
    snapshot: rtCtx.snapshot,
    target: rtCtx.target,
    getOverrides: () => rt95OverridesForWrite(deps.buildId),
    initialSettingsTicked: p.settings,
    sameRadio,
    settingsOnly: p.settings && !writesToRadioImage(p),
    initialChoice: defaultRt95SettingsChoice(store.read?.bandlimit, rtCtx.bandlimit),
    initialBackup: existing ? { status: 'saved', at: existing.at } : { status: 'none' },
    onReviewSettings: () => {
      setRt95Read(deps.buildId, rt95SettingsReadFromSnapshot(rtCtx.snapshot, deps.egress, deps.now()));
      deps.requestReviewSettings();
    },
  });
}

export const rt95SettingsPart: RadioSettingsPart = {
  matches: isRt95RadioIoProfileId,
  pendingChangeCount(buildId) {
    return getRt95RadioSettingsSession(buildId).overrides.size;
  },
  takeRestoredTicks() {
    return undefined;
  },
  saveTicks() {
    /* RT95 has no stepper tick stash. */
  },
  uploadOptions(buildId) {
    return { rt95SettingsOverrides: rt95OverridesForWrite(buildId) };
  },
  async writeSettingsOnly(session, deps, run) {
    const overrides = rt95OverridesForWrite(deps.buildId);
    const descriptor = deps.getDescriptor();
    const p = deps.getParts();
    const settingsPlan = descriptor
      ? planForOperation(descriptor, 'write', {
          parts: p,
          session,
          prepared: {
            channels: [],
            organisation: { rt95SettingsOverrides: overrides },
          },
        })
      : undefined;
    deps.onSettingsPlan?.(settingsPlan);
    return writeRt95SettingsOnly(session, deps.egress, overrides, {
      onProgress: run.onProgress,
      signal: run.signal,
      beforeTransmit: async (rtCtx) => {
        const decision = await run.beforeTransmit({ rt95Settings: rtCtx, settingsPlan });
        return decision as Rt95PreTransmitResult;
      },
    });
  },
  createReviewController(txCtx, _channels, deps) {
    if (!txCtx.rt95Settings) return null;
    return buildController(txCtx.rt95Settings, deps.getParts(), deps);
  },
  reviewSectionBindings(controller, _txCtx, modData) {
    return modData
      ? { rt95: { modData, settings: controller as Rt95ReviewController } }
      : { rt95: { settings: controller as Rt95ReviewController } };
  },
  pauseResult(_controller, buildId, willWrite) {
    if (!willWrite) return 'keep';
    return { decision: 'apply', overrides: rt95OverridesForWrite(buildId) };
  },
  settingsWillBeWritten,
  changedCount(controller, buildId) {
    const c = controller as Rt95ReviewController;
    return rt95SettingChanges(c.init.snapshot, c.init.target, rt95OverridesForWrite(buildId)).length;
  },
};
