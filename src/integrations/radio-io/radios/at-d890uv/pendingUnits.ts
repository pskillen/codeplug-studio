/**
 * Erase units left pending on an AT-D890UV by a Write that was abandoned without `END` (#1406).
 *
 * A unit gets the PC marker when the writer leaves it for the next unit, and the marker survives
 * a power-cycle. The next write-mode `END` from **any** tool (Studio or the CPS) promotes every
 * marked half, so the units an aborted session had already finished are committed later, on top
 * of whatever that later write meant to do. The unit in progress at the abort has no marker and is
 * never promoted (anytone-d890-firmware F248 to F251, Q78; emulator cases F to H).
 *
 * The only cure is to write those units again in a session that ends with `END`. Studio records
 * them here, in browser storage, and refuses any D890 write that would not rewrite them
 * (see {@link gateAtD890Write} in `programSession.ts`). An automatic repair Write is #1426.
 *
 * Browser storage can be empty or throw (private window, cleared site data), so every access is
 * wrapped: the record is best effort, and the warning shown on the failure still names the units.
 */

import { RadioProtocolError } from '../../kit/errors.ts';

export const AT_D890_PENDING_UNITS_KEY = 'codeplug-studio:d890-pending-units';

interface PendingRecord {
  v: 1;
  units: number[];
  recordedAt: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Units recorded as pending, ascending. Empty when none, or when storage is unavailable. */
export function readAtD890PendingUnits(): number[] {
  try {
    const raw = storage()?.getItem(AT_D890_PENDING_UNITS_KEY);
    if (!raw) return [];
    const rec = JSON.parse(raw) as Partial<PendingRecord>;
    if (rec.v !== 1 || !Array.isArray(rec.units)) return [];
    return rec.units.filter((u): u is number => Number.isInteger(u)).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function writePending(units: readonly number[]): void {
  try {
    const st = storage();
    if (!st) return;
    if (units.length === 0) {
      st.removeItem(AT_D890_PENDING_UNITS_KEY);
      return;
    }
    const rec: PendingRecord = {
      v: 1,
      units: [...new Set(units)].sort((a, b) => a - b),
      recordedAt: new Date().toISOString(),
    };
    st.setItem(AT_D890_PENDING_UNITS_KEY, JSON.stringify(rec));
  } catch {
    // Best effort: the failure's own warning still names the units.
  }
}

/** Add units to the pending record (a union with what is already recorded). */
export function recordAtD890PendingUnits(units: readonly number[]): void {
  if (units.length === 0) return;
  writePending([...readAtD890PendingUnits(), ...units]);
}

/** A write-mode `END` committed these units: drop them from the record. */
export function clearAtD890PendingUnits(committed?: readonly number[]): void {
  if (committed === undefined) {
    writePending([]);
    return;
  }
  const done = new Set(committed);
  writePending(readAtD890PendingUnits().filter((u) => !done.has(u)));
}

function hexUnits(units: readonly number[]): string {
  return units.map((u) => `0x${u.toString(16)}`).join(', ');
}

/** Shown next to the failure of a Write that left units pending. */
export function describeAtD890PendingUnits(units: readonly number[]): string {
  return (
    `The radio may hold part of this Write: ${units.length} erase unit${units.length === 1 ? '' : 's'} ` +
    `(${hexUnits(units)}) had already been sent and will be committed by the next write from any ` +
    `tool, Studio or the CPS. Do a full Write from Studio (codeplug and contacts) before any other ` +
    `write.`
  );
}

/** Thrown, before any byte is sent, by a write that would not rewrite the pending units. */
export class AtD890PendingUnitsError extends RadioProtocolError {
  constructor(readonly units: readonly number[]) {
    super(
      `An earlier Write to this radio was interrupted. ${describeAtD890PendingUnits(units)} ` +
        `Nothing was sent.`,
    );
    this.name = 'AtD890PendingUnitsError';
  }
}
