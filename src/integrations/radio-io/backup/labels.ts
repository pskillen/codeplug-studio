import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  RADIO_BACKUP_LABEL_FIELDS,
  RadioBackupError,
  normaliseBackupLabels,
  validateRadioBackupManifest,
  type RadioBackupLabels,
  type RadioBackupManifestV1,
} from './types.ts';

/**
 * Return `manifest` with its descriptive fields replaced by `labels` (blank fields removed).
 * Pure; no other manifest member changes.
 */
export function manifestWithBackupLabels(
  manifest: RadioBackupManifestV1,
  labels: RadioBackupLabels,
): RadioBackupManifestV1 {
  const next: RadioBackupManifestV1 = { ...manifest };
  for (const field of RADIO_BACKUP_LABEL_FIELDS) delete next[field];
  return { ...next, ...normaliseBackupLabels(labels) };
}

/**
 * Rewrite only `manifest.json` in a packed backup zip with new descriptive fields. Region bins and
 * sidecars are carried over byte for byte. The archive holds no hash over the manifest, so nothing
 * else needs updating.
 */
export function relabelRadioBackupZip(
  zipBytes: Uint8Array,
  labels: RadioBackupLabels,
): { zipBytes: Uint8Array; manifest: RadioBackupManifestV1 } {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    throw new RadioBackupError('Radio backup zip could not be read.');
  }
  const raw = entries['manifest.json'];
  if (!raw) throw new RadioBackupError('Radio backup zip is missing manifest.json.');
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    throw new RadioBackupError('Radio backup manifest.json is not valid JSON.');
  }
  const manifest = manifestWithBackupLabels(validateRadioBackupManifest(json), labels);
  entries['manifest.json'] = strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
  return { zipBytes: zipSync(entries), manifest };
}
