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
import { RadioWriteBlockedError } from './radioIoSession.ts';

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

export async function writeRt95SettingsOnly(
  session: RadioSession,
  egress: EgressPath,
  overrides: readonly Rt95SettingsOverride[],
  prePauseImage: Uint8Array,
  opts?: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
  },
): Promise<WriteRt95SettingsOnlyResult> {
  if (overrides.length === 0) {
    throw new RadioWriteBlockedError('There are no radio settings to write.');
  }
  const radio = requireRt95(session);
  const target = rt95SettingsTargetForProfile(egress.profileId);
  const existingDigits = rt95PasswordDigitsFromImage(prePauseImage);
  const patches = resolveRt95SettingsPatches(overrides, target, {
    existingPasswordDigits: existingDigits,
  });
  const image = createMemoryMap(prePauseImage.length);
  image.bytes.set(prePauseImage);
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
