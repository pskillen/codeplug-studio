/**
 * Range-change journal (Danger zone, #1369): one small record per radio serial in browser storage, so an
 * unfinished AT-D890 range change can be resumed after a reload. It never holds backup bytes: the user's saved
 * zip is the durable copy. The serial is operator data and stays in this browser only.
 *
 * Every storage access is in try/catch. When storage is unavailable nothing is shown and nothing throws; the
 * "Finish a range change from a backup file" path still works without it.
 */

export const RANGE_CHANGE_JOURNAL_KEY = 'codeplug-studio.radio-tools.range-change-journal.v1';

/** `sending` is written before the frame goes out; `done` entries stay as history. */
export type RangeChangeStage = 'sending' | 'changed' | 'restored' | 'done';

export interface RangeChangeJournalEntry {
  serial: string;
  model: 'AT-D890UV';
  fromCode: number;
  toCode: number;
  stage: RangeChangeStage;
  backup: { fileName: string; sha256: string; savedAt: string };
  vital: { fileName: string; sha256: string };
  startedAt: string;
  updatedAt: string;
  studioVersion: string;
}

/** Newest `done` entries kept as the "Last change" history. */
export const RANGE_CHANGE_JOURNAL_KEEP_DONE = 5;

const STAGES: readonly string[] = ['sending', 'changed', 'restored', 'done'];

function isEntry(v: unknown): v is RangeChangeJournalEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  const b = e.backup as Record<string, unknown> | undefined;
  const t = e.vital as Record<string, unknown> | undefined;
  return (
    typeof e.serial === 'string' &&
    e.model === 'AT-D890UV' &&
    typeof e.fromCode === 'number' &&
    typeof e.toCode === 'number' &&
    typeof e.stage === 'string' &&
    STAGES.includes(e.stage) &&
    typeof b === 'object' &&
    b !== null &&
    typeof b.fileName === 'string' &&
    typeof b.sha256 === 'string' &&
    typeof b.savedAt === 'string' &&
    typeof t === 'object' &&
    t !== null &&
    typeof t.fileName === 'string' &&
    typeof t.sha256 === 'string' &&
    typeof e.startedAt === 'string' &&
    typeof e.updatedAt === 'string' &&
    typeof e.studioVersion === 'string'
  );
}

/** Keep only the known fields, so nothing else (and never bytes) rides along. */
function pick(e: RangeChangeJournalEntry): RangeChangeJournalEntry {
  return {
    serial: e.serial,
    model: e.model,
    fromCode: e.fromCode,
    toCode: e.toCode,
    stage: e.stage,
    backup: { fileName: e.backup.fileName, sha256: e.backup.sha256, savedAt: e.backup.savedAt },
    vital: { fileName: e.vital.fileName, sha256: e.vital.sha256 },
    startedAt: e.startedAt,
    updatedAt: e.updatedAt,
    studioVersion: e.studioVersion,
  };
}

function load(): RangeChangeJournalEntry[] {
  try {
    const raw = window.localStorage.getItem(RANGE_CHANGE_JOURNAL_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).map(pick);
  } catch {
    return [];
  }
}

function prune(entries: RangeChangeJournalEntry[]): RangeChangeJournalEntry[] {
  const open = entries.filter((e) => e.stage !== 'done');
  const done = entries
    .filter((e) => e.stage === 'done')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RANGE_CHANGE_JOURNAL_KEEP_DONE);
  return [...open, ...done];
}

function save(entries: RangeChangeJournalEntry[]): boolean {
  try {
    window.localStorage.setItem(RANGE_CHANGE_JOURNAL_KEY, JSON.stringify(prune(entries).map(pick)));
    return true;
  } catch {
    return false;
  }
}

/** Every record. Empty when storage is unavailable or corrupt. */
export function listRangeChangeJournal(): RangeChangeJournalEntry[] {
  return load();
}

export function readRangeChangeJournal(serial: string): RangeChangeJournalEntry | undefined {
  if (serial.trim() === '') return undefined;
  return load().find((e) => e.serial === serial);
}

/** Write (replace) the record for `entry.serial`. Returns false when storage refused; never throws. */
export function upsertRangeChangeJournal(entry: RangeChangeJournalEntry): boolean {
  const rest = load().filter((e) => e.serial !== entry.serial);
  return save([...rest, pick(entry)]);
}

export function clearRangeChangeJournal(serial: string): boolean {
  return save(load().filter((e) => e.serial !== serial));
}
