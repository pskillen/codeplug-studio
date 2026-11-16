/**
 * OpenGD77 / OpenUV380 debug comparison evidence: decoded FirmwareInfo identity and User Database
 * header from classified captured bytes only. Decoded sidecar summaries are not evidence, and an
 * invalid or missing source is unavailable, never a guess.
 */
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { OPENGD77_BACKUP_USER_DATABASE_ID } from './backupRestoreRoles.ts';
import { OPENUV380_USER_DB_HEADER_SIZE } from './constants.ts';
import { openGd77DebugIdentity, openGd77DebugRegionIdentity } from './debugCoverage.ts';
import { decodeUserDatabaseHeader } from './userDatabaseCodec.ts';

export interface OpenGd77CompareArchive {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  sidecars: Record<string, Uint8Array>;
}

export interface OpenGd77EvidenceRow {
  field: string;
  left: unknown;
  right: unknown;
  status: 'Changed' | 'Unchanged' | 'Unavailable';
}

export function openGd77ComparisonEvidence(
  archive: OpenGd77CompareArchive,
): Record<string, unknown> {
  const identity = openGd77DebugIdentity(archive.sidecars);
  const ok = identity?.status === 'ok' ? identity : undefined;
  const fields: Record<string, unknown> = {
    'Identity / Radio type': ok?.radioTypeLabel,
    'Identity / Revision': ok?.revision,
    'Identity / Build date': ok?.buildDate,
    'Identity / Flash ID': ok?.flashId,
    'Identity / Features': ok?.features,
  };
  const dbId = OPENGD77_BACKUP_USER_DATABASE_ID;
  const db = openGd77DebugRegionIdentity(archive.manifest, archive.regions, dbId)
    ? archive.regions[dbId]
    : undefined;
  let valid: boolean | undefined;
  let entries: number | undefined;
  if (db) {
    try {
      entries = decodeUserDatabaseHeader(db.subarray(0, OPENUV380_USER_DB_HEADER_SIZE)).entryCount;
      valid = true;
    } catch {
      valid = false;
    }
  }
  fields['User Database / Header valid'] = valid;
  fields['User Database / Entry count (header)'] = entries;
  fields['User Database / Captured bytes'] = db?.length;
  return fields;
}

const unavailable = (v: unknown) => v === undefined || v === null;

export function compareOpenGd77Evidence(
  first: OpenGd77CompareArchive,
  second: OpenGd77CompareArchive,
): OpenGd77EvidenceRow[] {
  const a = openGd77ComparisonEvidence(first);
  const b = openGd77ComparisonEvidence(second);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].map((field) => {
    const left = a[field];
    const right = b[field];
    return {
      field,
      left,
      right,
      status:
        unavailable(left) || unavailable(right)
          ? 'Unavailable'
          : JSON.stringify(left) === JSON.stringify(right)
            ? 'Unchanged'
            : 'Changed',
    };
  });
}
