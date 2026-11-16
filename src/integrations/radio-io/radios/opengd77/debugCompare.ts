/**
 * OpenGD77 / OpenUV380 debug comparison evidence: decoded FirmwareInfo identity and User Database
 * header from classified captured bytes only. Decoded sidecar summaries are not evidence, and an
 * invalid or missing source is unavailable, never a guess.
 */
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { regionSections, type DebugCompareAdapter } from '../../debugCompare/index.ts';
import { OPENGD77_BACKUP_USER_DATABASE_ID } from './backupRestoreRoles.ts';
import { OPENUV380_USER_DB_HEADER_SIZE } from './constants.ts';
import { selectOpenGd77Calibration } from './debugCalibration.ts';
import { openGd77DebugIdentity, openGd77DebugRegionIdentity } from './debugCoverage.ts';
import { openGd77DecodedSnapshot } from './debugCompareDecoded.ts';
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

/** A source that was captured but does not decode: the value names why, never a guess. */
export interface OpenGd77InvalidEvidence {
  invalid: string;
}

export const isOpenGd77InvalidEvidence = (v: unknown): v is OpenGd77InvalidEvidence =>
  typeof v === 'object' && v !== null && typeof (v as { invalid?: unknown }).invalid === 'string';

export function openGd77ComparisonEvidence(
  archive: OpenGd77CompareArchive,
): Record<string, unknown> {
  const identity = openGd77DebugIdentity(archive.sidecars);
  const ok = identity?.status === 'ok' ? identity : undefined;
  const bad: OpenGd77InvalidEvidence | undefined =
    identity?.status === 'invalid' ? { invalid: identity.reason } : undefined;
  const fields: Record<string, unknown> = {
    'Identity / Radio type': bad ?? ok?.radioTypeLabel,
    'Identity / Revision': bad ?? ok?.revision,
    'Identity / Build date': bad ?? ok?.buildDate,
    'Identity / Flash ID': bad ?? ok?.flashId,
    'Identity / Features': bad ?? ok?.features,
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
  // Working copy rows, by decoded value; only with the local marker present, else unavailable.
  const calibration = selectOpenGd77Calibration(archive);
  if (calibration.status === 'ok' && calibration.decode.markerPresent) {
    for (const row of calibration.decode.rows) {
      fields[`Calibration / ${row.id}`] = row.decoded;
    }
  } else {
    fields['Calibration'] = undefined;
  }
  return fields;
}

/** OpenGD77 FLASH spans and the calibration working copy, by region id; anything else is refused. */
export const openGd77CompareAdapter: DebugCompareAdapter = {
  sections: (a, b) =>
    regionSections(a, b, (archive, id) =>
      openGd77DebugRegionIdentity(archive.manifest, archive.regions, id),
    ),
  regionIdentity: (archive, id) =>
    openGd77DebugRegionIdentity(archive.manifest, archive.regions, id),
  decoded: openGd77DecodedSnapshot,
};

const unavailable = (v: unknown) => v === undefined || v === null || isOpenGd77InvalidEvidence(v);

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
