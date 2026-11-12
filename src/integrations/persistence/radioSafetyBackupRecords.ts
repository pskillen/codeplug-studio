/**
 * "A safety backup is saved for this radio" (RT95 first, keyed by `family`): one small record per backup in
 * browser storage. It never holds bytes; the operator's saved file is the durable copy. `radioKey` is the
 * serial the operator typed from the radio's label, normalised.
 *
 * Every storage access is in try/catch; with no storage there is simply no record and nothing throws.
 */

export const RADIO_SAFETY_BACKUP_KEY = 'codeplug-studio.radio-safety-backups.v1';

export interface RadioSafetyBackupRecord {
  family: string;
  radioKey: string;
  region: 'cal' | 'full';
  fileName: string;
  sha256: string;
  fingerprint: string;
  savedAt: string;
  studioVersion: string;
}

function isRecord(v: unknown): v is RadioSafetyBackupRecord {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.family === 'string' &&
    typeof e.radioKey === 'string' &&
    e.radioKey !== '' &&
    (e.region === 'cal' || e.region === 'full') &&
    typeof e.fileName === 'string' &&
    typeof e.sha256 === 'string' &&
    typeof e.fingerprint === 'string' &&
    typeof e.savedAt === 'string' &&
    typeof e.studioVersion === 'string'
  );
}

/** Known fields only, so nothing else (and never bytes) rides along. */
function pick(e: RadioSafetyBackupRecord): RadioSafetyBackupRecord {
  return {
    family: e.family,
    radioKey: e.radioKey,
    region: e.region,
    fileName: e.fileName,
    sha256: e.sha256,
    fingerprint: e.fingerprint,
    savedAt: e.savedAt,
    studioVersion: e.studioVersion,
  };
}

function load(): RadioSafetyBackupRecord[] {
  try {
    const raw = window.localStorage.getItem(RADIO_SAFETY_BACKUP_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecord).map(pick) : [];
  } catch {
    return [];
  }
}

/** Newest first. */
function newestFirst(entries: RadioSafetyBackupRecord[]): RadioSafetyBackupRecord[] {
  return [...entries].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Every record for `family`, newest first. Empty when storage is unavailable or corrupt. */
export function listSafetyBackupRecords(family: string): RadioSafetyBackupRecord[] {
  return newestFirst(load().filter((e) => e.family === family));
}

/** The newest record for this radio, or undefined. Any age counts. */
export function findSafetyBackupRecord(
  family: string,
  radioKey: string,
): RadioSafetyBackupRecord | undefined {
  return listSafetyBackupRecords(family).find((e) => e.radioKey === radioKey);
}

/** Add a record. Returns false when storage refused; never throws. */
export function recordSafetyBackup(entry: RadioSafetyBackupRecord): boolean {
  try {
    const rest = load().filter(
      (e) =>
        !(e.family === entry.family && e.radioKey === entry.radioKey && e.sha256 === entry.sha256),
    );
    window.localStorage.setItem(RADIO_SAFETY_BACKUP_KEY, JSON.stringify([...rest, pick(entry)]));
    return true;
  } catch {
    return false;
  }
}
