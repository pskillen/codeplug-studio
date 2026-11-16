/**
 * OpenGD77 firmware settings and codeplug general settings from a debug archive: selection (is
 * the archive's model identified and does it match), then a read-only decode of whatever the
 * captured FLASH spans hold. It never reads a radio. The capture's debug-only settings gap (`0x6060-0x60BF`) completes the struct. Wire facts:
 * docs/reference/radios/baofeng/dm-1701/settings.md and docs/reference/radios/tyt/md-9600/settings.md.
 */
import {
  decodeOpenGd77CodeplugGeneral,
  decodeOpenGd77Settings,
  type OpenGd77CodeplugGeneralRow,
  type OpenGd77SettingsDecode,
  type OpenGd77SettingsModel,
} from '@core/radios/opengd77/settings.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import {
  describeOpenGd77RadioType,
  openGd77DebugIdentity,
  openGd77DebugModel,
  type OpenGd77DebugModel,
} from './debugCoverage.ts';
import { openGd77CapturedImage } from './debugMemory.ts';
import { OPENGD77_DM1701_MODEL_ID } from './hydration.ts';
import { readAbs } from './memory.ts';

export type OpenGd77SettingsSelection =
  | {
      status: 'ok';
      model: OpenGd77DebugModel;
      settings: OpenGd77SettingsDecode;
      general: OpenGd77CodeplugGeneralRow[];
    }
  | { status: 'unavailable'; reason: string };

export function selectOpenGd77Settings(archive: {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  sidecars: Record<string, Uint8Array>;
}): OpenGd77SettingsSelection {
  const bad = (reason: string): OpenGd77SettingsSelection => ({ status: 'unavailable', reason });
  const model = openGd77DebugModel(archive.manifest.radioModelId);
  if (!model)
    return bad(`the archive model ${archive.manifest.radioModelId} has no settings layout`);
  const identity = openGd77DebugIdentity(archive.sidecars);
  if (!identity) return bad('this archive has no FirmwareInfo, so the model is not identified');
  if (identity.status === 'invalid') {
    return bad(
      `the archive FirmwareInfo is invalid (${identity.reason}), so the model is not identified`,
    );
  }
  if (!model.radioTypes.includes(identity.radioType)) {
    return bad(
      `the radio reports ${describeOpenGd77RadioType(identity.radioType)}, but the archive is for ${model.label}`,
    );
  }
  const captured = openGd77CapturedImage(archive);
  const read = (abs: number, length: number) =>
    captured.covers(abs, length) ? readAbs(captured.image, abs, length) : undefined;
  const settingsModel: OpenGd77SettingsModel =
    model.modelId === OPENGD77_DM1701_MODEL_ID ? 'dm-1701' : 'md-9600';
  return {
    status: 'ok',
    model,
    settings: decodeOpenGd77Settings(settingsModel, read),
    general: decodeOpenGd77CodeplugGeneral(read),
  };
}
