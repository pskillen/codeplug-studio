/**
 * Read-only RadioFoundry Memory projection: reassemble the parser image from a debug archive and
 * decode it with the same import parser Studio uses elsewhere.
 */
import { RADIOFOUNDRY_IMAGE_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';
import {
  parseRadioFoundryCodeplug,
  RadioFoundryImportError,
  type BinaryCpsImportResult,
} from '@core/import-export/formats/radiofoundry/parse.ts';
import { resolveRadioFoundryProfile } from '@core/import-export/formats/radiofoundry/profiles.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { EEPROM_IMAGE_END, FLASH_IMAGE_START } from './constants.ts';
import { RADIOFOUNDRY_REGION } from './debugCapture.ts';
import { radioFoundryCableBoardForModelId } from './board.ts';

export type RadioFoundryMemoryProjection =
  | { status: 'not-captured'; reason: string }
  | { status: 'not-decoded'; reason: string }
  | { status: 'ok'; result: BinaryCpsImportResult; profileLabel: string };

export interface RadioFoundryMemoryArchive {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
}

/** Stitch EEPROM, the unserved gap as 0xFF, and flash into the parser image, or undefined without flash. */
export function reassembleRadioFoundryImage(
  archive: RadioFoundryMemoryArchive,
): Uint8Array | undefined {
  const flash = archive.regions[RADIOFOUNDRY_REGION.flash];
  if (!flash) return undefined;
  const image = new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE);
  image.fill(0xff);
  const eeprom = archive.regions[RADIOFOUNDRY_REGION.eeprom];
  if (eeprom) image.set(eeprom.subarray(0, Math.min(eeprom.length, EEPROM_IMAGE_END)), 0);
  const expectedFlashLen = RADIOFOUNDRY_IMAGE_SIZE - FLASH_IMAGE_START;
  const flashLen = Math.min(flash.length, expectedFlashLen);
  image.set(flash.subarray(0, flashLen), FLASH_IMAGE_START);
  if (flash.length < expectedFlashLen) {
    return image.subarray(0, FLASH_IMAGE_START + flash.length);
  }
  return image;
}

/** Decode Memory from a RadioFoundry debug archive; no project id and no library access. */
export function projectRadioFoundryMemory(
  archive: RadioFoundryMemoryArchive,
): RadioFoundryMemoryProjection {
  const image = reassembleRadioFoundryImage(archive);
  if (!image) {
    return { status: 'not-captured', reason: 'The flash-image region was not captured.' };
  }
  const board = radioFoundryCableBoardForModelId(archive.manifest.radioModelId);
  if (!board) {
    return {
      status: 'not-captured',
      reason: `No RadioFoundry board is registered for ${archive.manifest.radioModelId}.`,
    };
  }
  try {
    const result = parseRadioFoundryCodeplug(image, '', board.radioIoProfileId);
    const profile = resolveRadioFoundryProfile(board.radioIoProfileId);
    return { status: 'ok', result, profileLabel: profile.label };
  } catch (err) {
    const reason =
      err instanceof RadioFoundryImportError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return { status: 'not-decoded', reason };
  }
}
