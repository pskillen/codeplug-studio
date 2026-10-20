import { unzipSync, strFromU8 } from 'fflate';
import {
  RadioBackupError,
  validateRadioBackupManifest,
  type RadioBackupManifestV1,
} from './types.ts';

export interface ParsedRadioBackupZip {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  /** Files that are not the manifest or a named region bin (calibration JSON, …). */
  sidecars: Record<string, Uint8Array>;
}

/**
 * Unzip and fail-closed-validate a v1 radio-backup archive.
 * Rejects missing/invalid manifest, missing bins, and truncated bins.
 */
export function parseRadioBackupZip(bytes: Uint8Array): ParsedRadioBackupZip {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new RadioBackupError('Radio backup zip could not be read.');
  }

  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) {
    throw new RadioBackupError('Radio backup zip is missing manifest.json.');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(strFromU8(manifestBytes)) as unknown;
  } catch {
    throw new RadioBackupError('Radio backup manifest.json is not valid JSON.');
  }

  const manifest = validateRadioBackupManifest(parsedJson);
  const regions: Record<string, Uint8Array> = {};
  const regionPaths = new Set(manifest.regions.map((region) => region.path));
  const sidecars: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(entries)) {
    if (path === 'manifest.json' || regionPaths.has(path)) continue;
    sidecars[path] = data;
  }

  for (const region of manifest.regions) {
    const data = entries[region.path];
    if (!data) {
      throw new RadioBackupError(`Radio backup zip is missing region file ${region.path}.`);
    }
    if (data.byteLength !== region.byteLength) {
      throw new RadioBackupError(
        `Radio backup region ${region.id} is ${data.byteLength} bytes, expected ${region.byteLength}.`,
      );
    }
    regions[region.id] = data;
  }

  return { manifest, regions, sidecars };
}
