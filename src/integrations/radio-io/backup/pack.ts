import { zipSync, strToU8 } from 'fflate';
import {
  RadioBackupError,
  validateRadioBackupManifest,
  type RadioBackupManifestV1,
} from './types.ts';

/**
 * Pack a v1 radio-backup zip: `manifest.json` plus one bin per named region.
 * Synchronous and side-effect-free. Does not persist, assemble, or touch React.
 */
export function packRadioBackupZip(
  manifest: RadioBackupManifestV1,
  regionBytes: Record<string, Uint8Array>,
): Uint8Array {
  const validated = validateRadioBackupManifest(manifest);
  const entries: Record<string, Uint8Array> = {
    'manifest.json': strToU8(`${JSON.stringify(validated, null, 2)}\n`),
  };

  for (const region of validated.regions) {
    const bytes = regionBytes[region.id];
    if (!(bytes instanceof Uint8Array)) {
      throw new RadioBackupError(`Radio backup pack is missing bytes for region ${region.id}.`);
    }
    if (bytes.byteLength !== region.byteLength) {
      throw new RadioBackupError(
        `Radio backup pack region ${region.id} is ${bytes.byteLength} bytes, expected ${region.byteLength}.`,
      );
    }
    entries[region.path] = bytes;
  }

  for (const id of Object.keys(regionBytes)) {
    if (!validated.regions.some((region) => region.id === id)) {
      throw new RadioBackupError(`Radio backup pack has bytes for unknown region ${id}.`);
    }
  }

  return zipSync(entries);
}
