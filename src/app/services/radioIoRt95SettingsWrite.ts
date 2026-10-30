/**
 * RT95 radio settings: read snapshot and settings-only write (#1476).
 */

import { isMm9pdyRt95RadioIoProfileId } from '@core/import-export/formatProfiles.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/index.ts';
import { Rt95Protocol } from '@integrations/radio-io/radios/rt95/protocol.ts';
import {
  resolveRt95SettingsPatches,
  rt95PasswordDigitsFromImage,
  rt95SettingsTargetForProfile,
  type Rt95RadioSettingsSnapshot,
  type Rt95SettingsOverride,
} from '@integrations/radio-io/radios/rt95/settingsFields.ts';
import type { WriteVerifyCaptureResult } from '@integrations/radio-io/writeVerify.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import {
  RadioWriteBlockedError,
  RadioWriteCancelledError,
  rt95PauseOutcome,
  type Rt95PreTransmitContext,
  type Rt95PreTransmitResult,
} from './radioIoSession.ts';

function requireRt95(session: RadioSession): Rt95Protocol {
  if (!(session.radio instanceof Rt95Protocol)) {
    throw new RadioWriteBlockedError('Connected radio is not an RT95.');
  }
  return session.radio;
}

export async function readRt95SettingsSnapshot(
  session: RadioSession,
  opts?: { signal?: AbortSignal; onProgress?: ProgressFn },
): Promise<Rt95RadioSettingsSnapshot> {
  return requireRt95(session).readSettingsSnapshot(opts);
}

export interface WriteRt95SettingsOnlyResult {
  writeVerifyPending?: WriteVerifyCaptureResult;
}

/**
 * Write only registered settings overrides. Reads the clone image first, pauses for Review, then
 * patches only the touched blocks (never the full 0x32A0 upload).
 */
export async function writeRt95SettingsOnly(
  session: RadioSession,
  egress: EgressPath,
  overrides: readonly Rt95SettingsOverride[],
  opts?: {
    beforeTransmit?: (ctx: Rt95PreTransmitContext) => Promise<Rt95PreTransmitResult>;
    onProgress?: ProgressFn;
    signal?: AbortSignal;
  },
): Promise<WriteRt95SettingsOnlyResult> {
  if (overrides.length === 0) {
    throw new RadioWriteBlockedError('There are no radio settings to write.');
  }
  const radio = requireRt95(session);
  const target = rt95SettingsTargetForProfile(egress.profileId);
  resolveRt95SettingsPatches(overrides, target, {
    existingPasswordDigits: undefined,
  });

  const snapshot = await radio.readSettingsSnapshot({
    signal: opts?.signal,
    onProgress: opts?.onProgress,
  });
  const prePauseCtx: Rt95PreTransmitContext = {
    bandlimit: snapshot.bandlimit,
    snapshot,
    overrides,
    target,
  };
  const result = opts?.beforeTransmit ? await opts.beforeTransmit(prePauseCtx) : 'cancel';
  const outcome = rt95PauseOutcome(result, overrides);
  if (outcome.decision !== 'apply') throw new RadioWriteCancelledError();
  if (outcome.overrides.length === 0) {
    throw new RadioWriteBlockedError('There are no radio settings to write.');
  }
  const existingDigits = rt95PasswordDigitsFromImage(snapshot.image);
  const patches = resolveRt95SettingsPatches(outcome.overrides, target, {
    existingPasswordDigits: existingDigits,
  });
  const image = createMemoryMap(snapshot.image.length);
  image.bytes.set(snapshot.image);
  await radio.uploadSettingsPatches(patches, image, {
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
  const captured = session.descriptor.writeVerify?.captureAfterUpload(session);
  return captured ? { writeVerifyPending: captured } : {};
}

export function rt95SettingsTargetForEgress(
  egress: EgressPath,
): ReturnType<typeof rt95SettingsTargetForProfile> {
  return rt95SettingsTargetForProfile(egress.profileId);
}

export function isRt95SettingsMm9pdyTarget(egress: EgressPath): boolean {
  return isMm9pdyRt95RadioIoProfileId(egress.profileId);
}

export type { Rt95PreTransmitContext, Rt95PreTransmitResult };
