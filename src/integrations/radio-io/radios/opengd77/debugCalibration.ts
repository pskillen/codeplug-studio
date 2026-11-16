/**
 * OpenGD77 calibration working copy in a debug archive: region constants, the guarded read, and
 * selection (is it there, is it the expected shape, does the archive identify the model). This is
 * the OpenGD77 working copy, never stock factory calibration. Wire facts:
 * docs/reference/radios/opengd77/calibration.md.
 */
import {
  OPENGD77_CALIBRATION_LENGTH,
  decodeOpenGd77Calibration,
  type OpenGd77CalibrationDecode,
} from '@core/radios/opengd77/calibration.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import {
  OPENGD77_CALIBRATION_ADDRESS,
  OPENGD77_CALIBRATION_REGION_ID,
  OPENGD77_CALIBRATION_REGION_PATH,
} from './constants.ts';
import {
  describeOpenGd77RadioType,
  openGd77DebugIdentity,
  openGd77DebugModel,
  type OpenGd77DebugModel,
} from './debugCoverage.ts';

export {
  OPENGD77_CALIBRATION_ADDRESS,
  OPENGD77_CALIBRATION_REGION_ID,
  OPENGD77_CALIBRATION_REGION_PATH,
} from './constants.ts';
export { readOpenGd77CalibrationWorkingCopy } from './debugCapture.ts';

export type OpenGd77CalibrationSelection =
  | {
      status: 'ok';
      model: OpenGd77DebugModel;
      decode: OpenGd77CalibrationDecode;
      bytes: Uint8Array;
    }
  | { status: 'not-captured' }
  | { status: 'unavailable'; reason: string };

export function selectOpenGd77Calibration(archive: {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  sidecars: Record<string, Uint8Array>;
}): OpenGd77CalibrationSelection {
  const region = archive.manifest.regions.find((r) => r.id === OPENGD77_CALIBRATION_REGION_ID);
  if (!region) return { status: 'not-captured' };
  const bad = (reason: string): OpenGd77CalibrationSelection => ({
    status: 'unavailable',
    reason,
  });
  if (region.address !== OPENGD77_CALIBRATION_ADDRESS) {
    return bad(`the calibration region is at 0x${region.address.toString(16)}, not 0x10000`);
  }
  if (region.byteLength !== OPENGD77_CALIBRATION_LENGTH) {
    return bad(
      `the calibration region is ${region.byteLength} bytes, expected ${OPENGD77_CALIBRATION_LENGTH}`,
    );
  }
  if (region.restoreRole !== 'inspect-only') {
    return bad(`the calibration region role is ${region.restoreRole}, expected inspect-only`);
  }
  if (region.path !== OPENGD77_CALIBRATION_REGION_PATH) {
    return bad(`the calibration region path is ${region.path}`);
  }
  const bytes = archive.regions[OPENGD77_CALIBRATION_REGION_ID];
  if (bytes?.length !== OPENGD77_CALIBRATION_LENGTH) {
    return bad(
      `the stored calibration bytes are ${bytes?.length ?? 0} long, expected ${OPENGD77_CALIBRATION_LENGTH}`,
    );
  }
  const identity = openGd77DebugIdentity(archive.sidecars);
  if (!identity) return bad('this archive has no FirmwareInfo, so the model is not identified');
  if (identity.status === 'invalid') {
    return bad(
      `the archive FirmwareInfo is invalid (${identity.reason}), so the model is not identified`,
    );
  }
  const model = openGd77DebugModel(archive.manifest.radioModelId);
  if (!model)
    return bad(`the archive model ${archive.manifest.radioModelId} has no calibration layout`);
  if (!model.radioTypes.includes(identity.radioType)) {
    return bad(
      `the radio reports ${describeOpenGd77RadioType(identity.radioType)}, but the archive is for ${model.label}`,
    );
  }
  return {
    status: 'ok',
    model,
    decode: decodeOpenGd77Calibration(bytes, model.calibrationLowSlot),
    bytes,
  };
}
