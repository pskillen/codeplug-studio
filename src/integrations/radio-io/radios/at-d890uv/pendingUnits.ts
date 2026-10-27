/**
 * Erase units left pending on an AT-D890UV by a Write that was abandoned without `END` (#1406).
 *
 * A unit gets the PC marker when the writer leaves it for the next unit, and the marker survives
 * a power-cycle. The next write-mode `END` from **any** tool (Studio or the CPS) promotes every
 * marked half, so the units an aborted session had already finished are committed later, on top
 * of whatever that later write meant to do. The unit in progress at the abort has no marker and is
 * never promoted (anytone-d890-firmware F278; emulator cases F to H).
 *
 * The only cure is to write those units again in a session that ends with `END`. Studio records
 * them here, in browser storage, **per radio** (keyed by the LocalInfo serial), and refuses any
 * D890 write to that radio that would not rewrite them (see {@link gateAtD890Write} in
 * `programSession.ts`). An automatic repair Write is #1426.
 *
 * Two kinds of entry, both per radio:
 * - `units`: finished units of a Write that was abandoned (error, cancel).
 * - `inProgress`: written at the first `W` of a session and updated as units are entered, removed
 *   at `END` or when the session is abandoned. One that survives (tab closed, crash) is treated as
 *   pending, **including** the unit that was in progress (conservative: it is unknown whether the
 *   unit got its marker).
 *
 * A record that cannot be tied to one radio (serial unreadable) goes under {@link AT_D890_UNKNOWN_RADIO}
 * and blocks every D890 until the operator clears it: Studio cannot tell which radio it concerns,
 * so no Write can prove it was repaired.
 *
 * Browser storage can be empty or throw (private window, cleared site data), so every access is
 * wrapped: the record is best effort, and the warning shown on the failure still names the units.
 */

import { RadioProtocolError } from '../../kit/errors.ts';
import { D890_MAP } from './constants.ts';
import { isAtD890DigitalContactUnit } from './digitalContactUnits.ts';
import { eraseUnitBaseFor } from './eraseUnits.ts';

export const AT_D890_PENDING_UNITS_KEY = 'codeplug-studio:d890-pending-units';

/** Bucket for units recorded when the radio's serial could not be read. */
export const AT_D890_UNKNOWN_RADIO = 'unknown';

interface InProgressMarker {
  units: number[];
  startedAt: string;
  /** Which session wrote it, so a later session can tell a stale marker from its own. */
  session: string;
}

interface PendingEntry {
  units: number[];
  recordedAt: string;
  inProgress?: InProgressMarker;
}

interface PendingRecord {
  v: 2;
  radios: Record<string, PendingEntry>;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function sortedUnique(units: readonly number[]): number[] {
  return [...new Set(units)].sort((a, b) => a - b);
}

function cleanUnits(value: unknown): number[] {
  return Array.isArray(value)
    ? sortedUnique(value.filter((u): u is number => Number.isInteger(u)))
    : [];
}

function load(): PendingRecord {
  const empty: PendingRecord = { v: 2, radios: {} };
  try {
    const raw = storage()?.getItem(AT_D890_PENDING_UNITS_KEY);
    if (!raw) return empty;
    const rec = JSON.parse(raw) as Partial<PendingRecord>;
    if (rec.v !== 2 || typeof rec.radios !== 'object' || rec.radios === null) return empty;
    const radios: Record<string, PendingEntry> = {};
    for (const [radio, e] of Object.entries(rec.radios)) {
      if (typeof e !== 'object' || e === null) continue;
      const entry: PendingEntry = {
        units: cleanUnits(e.units),
        recordedAt: typeof e.recordedAt === 'string' ? e.recordedAt : '',
      };
      const ip = e.inProgress;
      if (ip && typeof ip === 'object' && typeof ip.session === 'string') {
        entry.inProgress = {
          units: cleanUnits(ip.units),
          startedAt: typeof ip.startedAt === 'string' ? ip.startedAt : '',
          session: ip.session,
        };
      }
      radios[radio] = entry;
    }
    return { v: 2, radios };
  } catch {
    return empty;
  }
}

function save(rec: PendingRecord): void {
  try {
    const st = storage();
    if (!st) return;
    for (const [radio, e] of Object.entries(rec.radios)) {
      if (e.units.length === 0 && !e.inProgress) delete rec.radios[radio];
    }
    if (Object.keys(rec.radios).length === 0) {
      st.removeItem(AT_D890_PENDING_UNITS_KEY);
      return;
    }
    st.setItem(AT_D890_PENDING_UNITS_KEY, JSON.stringify(rec));
  } catch {
    // Best effort: the failure's own warning still names the units.
  }
}

function effectiveUnits(e: PendingEntry): number[] {
  return sortedUnique([...e.units, ...(e.inProgress?.units ?? [])]);
}

/** What the operator is told about: one radio's pending units (or several, when blocking all). */
export interface AtD890PendingBlock {
  /** Storage keys behind this block: what a clear action removes. */
  radios: string[];
  /** Units to rewrite, ascending (a surviving in-progress marker included). */
  units: number[];
  /** When the record (or the interrupted session's first `W`) was made, ISO. Latest of several. */
  recordedAt: string;
  /** A session was cut off without a thrown error (tab closed, crash): units are conservative. */
  interrupted: boolean;
  /**
   * Cannot be satisfied by rewriting units: the record could not be tied to one radio, or this
   * radio's serial is unknown. Only the clear action lifts it.
   */
  hard: boolean;
}

function blockFrom(radios: string[], rec: PendingRecord, hard: boolean): AtD890PendingBlock | null {
  const entries = radios.map((r) => rec.radios[r]).filter((e): e is PendingEntry => !!e);
  const units = sortedUnique(entries.flatMap(effectiveUnits));
  if (units.length === 0) return null;
  const stamps = entries
    .map((e) => (e.inProgress && e.units.length === 0 ? e.inProgress.startedAt : e.recordedAt))
    .filter(Boolean)
    .sort();
  return {
    radios,
    units,
    recordedAt: stamps[stamps.length - 1] ?? '',
    interrupted: entries.some((e) => !!e.inProgress),
    hard,
  };
}

/**
 * What blocks a Write to the radio with this LocalInfo `serial` (`''` when unreadable), or `null`.
 * A record for another radio does not block this one.
 */
export function findAtD890PendingBlock(serial: string): AtD890PendingBlock | null {
  const rec = load();
  const keys = Object.keys(rec.radios);
  if (keys.length === 0) return null;
  if (!serial) return blockFrom(keys, rec, true);
  if (rec.radios[AT_D890_UNKNOWN_RADIO]) {
    return blockFrom(
      keys.filter((k) => k === AT_D890_UNKNOWN_RADIO || k === serial),
      rec,
      true,
    );
  }
  return rec.radios[serial] ? blockFrom([serial], rec, false) : null;
}

/**
 * The record of exactly one bucket, for the warning shown next to that radio's failure: `serial`
 * is the radio's LocalInfo serial, or `''` when it could not be read (the unknown-radio bucket).
 * Unlike {@link findAtD890PendingBlock} it never pulls in another bucket.
 */
export function findAtD890PendingBlockExact(serial: string): AtD890PendingBlock | null {
  const rec = load();
  const bucket = serial || AT_D890_UNKNOWN_RADIO;
  return blockFrom([bucket], rec, bucket === AT_D890_UNKNOWN_RADIO);
}

/** The most recently recorded block anywhere, for the warning shown next to a failure. */
export function findLatestAtD890PendingBlock(): AtD890PendingBlock | null {
  const rec = load();
  let best: AtD890PendingBlock | null = null;
  for (const radio of Object.keys(rec.radios)) {
    const b = blockFrom([radio], rec, radio === AT_D890_UNKNOWN_RADIO);
    if (b && (!best || b.recordedAt >= best.recordedAt)) best = b;
  }
  return best;
}

/** Units pending for this exact bucket (`radio` is a serial or {@link AT_D890_UNKNOWN_RADIO}). */
export function readAtD890PendingUnits(radio: string): number[] {
  const e = load().radios[radio];
  return e ? effectiveUnits(e) : [];
}

/** Add finished units of an abandoned session to a radio's record (a union). */
export function recordAtD890PendingUnits(radio: string, units: readonly number[]): void {
  if (units.length === 0) return;
  const rec = load();
  const e = rec.radios[radio] ?? { units: [], recordedAt: '' };
  e.units = sortedUnique([...e.units, ...units]);
  e.recordedAt = new Date().toISOString();
  rec.radios[radio] = e;
  save(rec);
}

/**
 * At each new unit entered by a session: persist the units it has entered so far, so a tab closed
 * or a crash before `END` is on record. A marker left by a *different* session is folded into the
 * pending units first (it is stale, and this session may not rewrite them).
 */
export function markAtD890WriteInProgress(
  radio: string,
  session: string,
  units: readonly number[],
): void {
  const rec = load();
  const e = rec.radios[radio] ?? { units: [], recordedAt: '' };
  if (e.inProgress && e.inProgress.session !== session) {
    e.units = sortedUnique([...e.units, ...e.inProgress.units]);
    e.recordedAt = e.inProgress.startedAt || new Date().toISOString();
    e.inProgress = undefined;
  }
  e.inProgress = {
    units: sortedUnique(units),
    startedAt: e.inProgress?.startedAt ?? new Date().toISOString(),
    session,
  };
  rec.radios[radio] = e;
  save(rec);
}

/** The session left PROGRAM (abandoned or ended): drop its own in-progress marker. */
export function settleAtD890InProgress(radio: string, session: string): void {
  const rec = load();
  const e = rec.radios[radio];
  if (!e?.inProgress || e.inProgress.session !== session) return;
  e.inProgress = undefined;
  save(rec);
}

/**
 * A write-mode `END` committed these units on this radio: drop them from its record, and the
 * session's own in-progress marker with them.
 */
export function clearAtD890PendingUnits(
  radio: string,
  committed: readonly number[],
  session?: string,
): void {
  const rec = load();
  const e = rec.radios[radio];
  if (!e) return;
  const done = new Set(committed);
  e.units = e.units.filter((u) => !done.has(u));
  if (e.inProgress && session !== undefined && e.inProgress.session === session) {
    e.inProgress = undefined;
  }
  save(rec);
}

/** The operator confirmed the radio was rewritten: remove these radios' records. */
export function clearAtD890PendingRadios(radios: readonly string[]): void {
  const rec = load();
  for (const r of radios) delete rec.radios[r];
  save(rec);
}

/** Remove every record (tests, and a full reset). */
export function clearAllAtD890PendingRecords(): void {
  save({ v: 2, radios: {} });
}

function hexUnits(units: readonly number[]): string {
  return units.map((u) => `0x${u.toString(16)}`).join(', ');
}

const SETTINGS_UNIT = eraseUnitBaseFor(D890_MAP.OptionalSettingsMain);

/**
 * The Write parts that rewrite these units, in the words of the stepper's tick list.
 * Contact units need "Digital contacts"; every other unit is the codeplug (the settings unit
 * alone can also be repaired by a settings-only Write).
 */
export function atD890PartsToTick(units: readonly number[]): string {
  const contacts = units.some((u) => isAtD890DigitalContactUnit(u));
  const rest = units.filter((u) => !isAtD890DigitalContactUnit(u));
  const settingsOnly = rest.length > 0 && rest.every((u) => u === SETTINGS_UNIT);
  if (contacts && rest.length > 0) return 'Codeplug and Digital contacts ticked';
  if (contacts) return 'Digital contacts ticked';
  return settingsOnly ? 'Codeplug (or Radio settings) ticked' : 'Codeplug ticked';
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** Shown next to the failure of a Write that left units pending, and on the refusal. */
export function describeAtD890PendingUnits(block: AtD890PendingBlock): string {
  const when = formatStamp(block.recordedAt);
  const stamp = when ? ` (recorded ${when})` : '';
  const how = block.interrupted
    ? 'A Write was cut off before it finished (the tab was closed or the app crashed)'
    : 'A Write was interrupted';
  const out =
    `${how}${stamp}. The radio may hold part of it, and the next write from any tool, Studio or ` +
    `the CPS, will commit it. `;
  const fix = block.hard
    ? `Studio cannot tell which radio this concerns, so no Write can repair it. If every radio ` +
      `involved has been rewritten since, clear the warning (button under the error in the Write dialog; Debug, LocalStorage as a fallback).`
    : `Before any other write, do a Write from Studio with ${atD890PartsToTick(block.units)}. ` +
      `If you have already rewritten this radio, with the CPS for example, clear the warning ` +
      `instead (button under the error in the Write dialog; Debug, LocalStorage as a fallback).`;
  const n = block.units.length;
  return `${out}${fix} (${n} erase unit${n === 1 ? '' : 's'}: ${hexUnits(block.units)}.)`;
}

/** Thrown, before any byte is sent, by a write that would not rewrite the pending units. */
export class AtD890PendingUnitsError extends RadioProtocolError {
  constructor(readonly block: AtD890PendingBlock) {
    super(
      `An earlier Write to this radio was interrupted. ${describeAtD890PendingUnits(block)} ` +
        `Nothing was sent.`,
    );
    this.name = 'AtD890PendingUnitsError';
  }

  get units(): readonly number[] {
    return this.block.units;
  }
}
