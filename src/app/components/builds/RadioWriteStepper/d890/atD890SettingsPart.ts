/**
 * AT-D890UV Radio settings part: session store, settings-only write, Review controller (#1963).
 */

import { isAtD890RadioIoProfileId } from '@core/import-export/formatProfiles.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import {
  decodeAtD890RadioSettings,
  languageLockFromLocalInfo,
  mm9pdyStepKeyOverrides,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { isAtD890MasterIdSelected } from '@integrations/radio-io/radios/at-d890uv/masterIdCodec.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { d890DownloadStages } from '@integrations/radio-io/radios/at-d890uv/plannedStages.ts';
import { getAtD890SessionSerial } from '@integrations/radio-io/radios/at-d890uv/programSession.ts';
import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import type {
  AtD890PreTransmitContext,
  AtD890PreTransmitResult,
} from '../../../../services/radioIoSession.ts';
import { atD890SettingsReadFromSnapshot } from '../../../../services/radioIoAtD890SettingsRead.ts';
import { writeAtD890SettingsOnly } from '../../../../services/radioIoAtD890SettingsWrite.ts';
import {
  packAtD890BackupFromSession,
  downloadRadioBackupZip,
} from '../../../../services/radioBackupRestore.ts';
import {
  addBackupThisSession,
  findBackupForSerial,
} from '../../../../state/radioSessionBackups.ts';
import {
  clearOverride,
  defaultSettingsChoice,
  getAtD890RadioSettingsSession,
  isSettingsReadRadio,
  overridesForWrite,
  setOverride,
  setRead,
  setStepperTicks,
} from '../../../../state/atD890RadioSettingsSession.ts';
import {
  type RadioSettingsPart,
  type RadioSettingsPartDeps,
  type RadioWriteExtras,
  type SettingsReviewController,
} from '../../../../services/egress/radioSettingsParts.ts';
import { writesToRadioImage, type WriteParts } from '../writeParts.ts';
import { estimateWriteSeconds } from '../writeEstimate.ts';
import {
  createAtD890ReviewController,
  type AtD890ReviewController,
} from './atD890ReviewController.ts';
import {
  atD890ReceiveOnlyChannels,
  atD890ReviewRange,
  atD890SettingChanges,
} from './atD890ReviewFacts.ts';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function settingsWillBeWritten(controller: SettingsReviewController, buildId: string): boolean {
  const state = controller.getState();
  const overrides = overridesForWrite(buildId);
  return state.settingsTicked && state.choice === 'apply' && overrides.length > 0;
}

function buildController(
  atCtx: AtD890PreTransmitContext,
  channels: readonly RadioChannelDto[],
  p: WriteParts,
  deps: RadioSettingsPartDeps,
): AtD890ReviewController {
  const store = getAtD890RadioSettingsSession(deps.buildId);
  const sameRadio = isSettingsReadRadio(store, atCtx.serial);
  const existing = findBackupForSerial(deps.buildId, atCtx.serial);
  const fullReadHeld = atCtx.downloadCache !== undefined;
  const download = estimateWriteSeconds(d890DownloadStages(), null);
  const controller: AtD890ReviewController = createAtD890ReviewController({
    buildId: deps.buildId,
    serial: atCtx.serial,
    masterIdName: atCtx.masterIdName,
    masterIdSelected: isAtD890MasterIdSelected(atCtx.snapshot.masterId),
    ...(atCtx.nxdnOwnIdLabel !== undefined ? { nxdnOwnIdLabel: atCtx.nxdnOwnIdLabel } : {}),
    range: atD890ReviewRange(atCtx.snapshot),
    receiveOnly: atD890ReceiveOnlyChannels(channels, atCtx.snapshot.bandCode),
    snapshot: atCtx.snapshot,
    target: atCtx.target,
    decoded: decodeAtD890RadioSettings(atCtx.snapshot, atCtx.target),
    languageLock: languageLockFromLocalInfo(atCtx.snapshot.localInfo),
    getOverrides: () => overridesForWrite(deps.buildId),
    onClearLanguage: () => clearOverride(deps.buildId, 'language'),
    initialSettingsTicked: p.settings,
    sameRadio,
    applyToEveryRadio: store.applyToEveryRadio,
    settingsOnly: p.settings && !writesToRadioImage(p),
    fullReadHeld,
    readRestSeconds: download == null ? null : Math.round(download / 5) * 5,
    initialChoice: defaultSettingsChoice(store, atCtx.serial),
    initialBackup: existing ? { status: 'saved', at: existing.at } : { status: 'none' },
    onSaveBackup: () => {
      const session = deps.getSession();
      if (session && atD890WriteExtras.saveBackupFromSession) {
        void atD890WriteExtras.saveBackupFromSession(session, atCtx, deps, () => controller);
      }
    },
    onReviewSettings: () => {
      setRead(
        deps.buildId,
        atD890SettingsReadFromSnapshot(atCtx.snapshot, atCtx.target, deps.now()),
      );
      deps.requestReviewSettings();
    },
    onUseStepKeys: () => {
      for (const o of mm9pdyStepKeyOverrides()) setOverride(deps.buildId, o.fieldId, o.value);
      const next = { ...deps.getParts(), settings: true };
      deps.setParts(next);
      controller.setChoice('apply');
      controller.setSettingsTicked(true);
    },
  });
  return controller;
}

async function saveD890Backup(
  atCtx: AtD890PreTransmitContext,
  deps: RadioSettingsPartDeps,
  controller: () => AtD890ReviewController,
): Promise<void> {
  const session = deps.getSession();
  const c = controller();
  if (!session) return;
  const signal = deps.getSignal();
  try {
    let cache = atCtx.downloadCache;
    if (!cache) {
      c.setBackup({ status: 'reading' });
      await session.radio.download({ signal });
      cache =
        session.radio instanceof AtD890uvProtocol
          ? (session.radio.getDownloadCache() ?? undefined)
          : undefined;
    }
    c.setBackup({ status: 'saving' });
    const packed = packAtD890BackupFromSession(session, cache ? { cache } : undefined);
    downloadRadioBackupZip(packed.zipBytes, packed.manifest);
    const at = deps.now();
    addBackupThisSession(deps.buildId, {
      serial: atCtx.serial,
      model: session.descriptor.label,
      name: atCtx.masterIdName,
      at,
    });
    c.setBackup({ status: 'saved', at });
  } catch (err) {
    c.setBackup({ status: 'error', message: errorMessage(err) });
  }
}

export const atD890SettingsPart: RadioSettingsPart = {
  matches: isAtD890RadioIoProfileId,
  pendingChangeCount(buildId) {
    return getAtD890RadioSettingsSession(buildId).overrides.size;
  },
  takeRestoredTicks(buildId) {
    const store = getAtD890RadioSettingsSession(buildId);
    const restored = store.stepperTicks;
    if (restored) setStepperTicks(buildId, undefined);
    return restored;
  },
  saveTicks(buildId, parts) {
    setStepperTicks(buildId, { ...parts });
  },
  uploadOptions(buildId) {
    return { settingsOverrides: overridesForWrite(buildId) };
  },
  async writeSettingsOnly(session, deps, run) {
    const overrides = overridesForWrite(deps.buildId);
    const descriptor = deps.getDescriptor();
    const settingsPlan = descriptor
      ? planForOperation(descriptor, 'write', { parts: deps.getParts(), session })
      : undefined;
    deps.onSettingsPlan?.(settingsPlan);
    return writeAtD890SettingsOnly(session, deps.egress, overrides, {
      onProgress: run.onProgress,
      signal: run.signal,
      beforeTransmit: async (atCtx) => {
        const decision = await run.beforeTransmit({ atD890: atCtx, settingsPlan });
        return decision as AtD890PreTransmitResult;
      },
    });
  },
  createReviewController(txCtx, channels, deps) {
    if (!txCtx.atD890) return null;
    return buildController(
      txCtx.atD890,
      channels as readonly RadioChannelDto[],
      deps.getParts(),
      deps,
    );
  },
  reviewSectionBindings(controller) {
    return { atD890: controller as AtD890ReviewController };
  },
  pauseResult(_controller, buildId, willWrite) {
    if (!willWrite) return 'keep';
    return { decision: 'apply', overrides: overridesForWrite(buildId) };
  },
  settingsWillBeWritten,
  changedCount(controller, buildId) {
    const c = controller as AtD890ReviewController;
    return atD890SettingChanges(c.init.snapshot, c.init.target, overridesForWrite(buildId)).length;
  },
};

export const atD890WriteExtras: RadioWriteExtras = {
  matches: isAtD890RadioIoProfileId,
  failedWriteSerial(session) {
    return getAtD890SessionSerial(session.pipe);
  },
  saveBackupFromSession(_session, txCtx, deps, controller) {
    return saveD890Backup(
      txCtx as AtD890PreTransmitContext,
      deps,
      controller as () => AtD890ReviewController,
    );
  },
};
