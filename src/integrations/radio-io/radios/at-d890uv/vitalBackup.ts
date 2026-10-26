/**
 * AT-D890UV vital-data read — tune banks and LocalInfo (#1288).
 *
 * Four whole 256 KiB units, read twice and compared byte for byte. Read-only: this module sends no `W` frames.
 * Hardware (V1.05): the upper tune unit is not marked live and the radio diverts that address to LocalInfo, so
 * its bytes are "as returned", not a B copy. See docs/reference/radios/anytone/at-d890uv/backup-restore.md.
 */

import { RadioProtocolError } from '../../kit/errors.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import type { BytePipe, ProgressFn } from '../../types.ts';
import { atD890ReadMemory } from './connection.ts';
import { AT_D890_BLOCK_SIZE, D890_MAP } from './constants.ts';
import { assertAtD890NoStunKill } from './stunKillGuard.ts';

/** One erase unit. No read frame may cross a boundary of this size. */
export const AT_D890_VITAL_UNIT_BYTES = 0x4_0000;

export interface AtD890VitalUnitDef {
  id: string;
  label: string;
  /** The address requested on the wire. */
  address: number;
  /** True when the radio is known to answer this address with another unit's bytes. */
  asReturned: boolean;
}

export const AT_D890_VITAL_UNITS: readonly AtD890VitalUnitDef[] = [
  { id: 'tune-a', label: 'Calibration (live)', address: 0x04f0_0000, asReturned: false },
  {
    id: 'tune-b',
    label: 'Calibration B (as returned)',
    address: 0x04f4_0000,
    asReturned: true,
  },
  { id: 'local-info', label: 'LocalInfo (live)', address: D890_MAP.LocalInfo, asReturned: false },
  {
    id: 'local-info-upper',
    label: 'LocalInfo B',
    address: 0x04fc_0000,
    asReturned: false,
  },
];

/** Progress slice: keeps the bar moving. Each unit read is still split on frame boundaries inside one unit. */
const SLICE_BYTES = 0x1_0000;

export interface AtD890VitalUnitBytes {
  def: AtD890VitalUnitDef;
  bytes: Uint8Array;
}

export interface AtD890VitalReadResult {
  units: AtD890VitalUnitBytes[];
  /** Both passes were compared byte for byte and matched. Always true on a returned result. */
  bothReadsMatched: true;
}

/** The two passes disagreed. No file may be produced. */
export class AtD890VitalMismatchError extends RadioProtocolError {
  readonly unitIds: string[];

  constructor(unitIds: string[]) {
    const names = unitIds.map((id) => AT_D890_VITAL_UNITS.find((u) => u.id === id)?.label ?? id);
    super(
      `Vital data read twice gave different bytes for: ${names.join(', ')}. ` +
        'No file was produced. Check the cable and try again.',
    );
    this.name = 'AtD890VitalMismatchError';
    this.unitIds = unitIds;
  }
}

export interface AtD890VitalReadSession {
  pipe: BytePipe;
  /** Called when a stun/kill flag stops the session, so the later disconnect sends no `END`. */
  abandonProgramMode: () => void;
  readBlockSize: number;
}

export interface AtD890VitalReadOptions {
  onProgress?: ProgressFn;
  signal?: AbortSignal;
}

async function readUnit(
  session: AtD890VitalReadSession,
  def: AtD890VitalUnitDef,
  onSlice: () => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const out = new Uint8Array(AT_D890_VITAL_UNIT_BYTES);
  for (let off = 0; off < AT_D890_VITAL_UNIT_BYTES; off += SLICE_BYTES) {
    const part = await atD890ReadMemory(
      session.pipe,
      def.address + off,
      SLICE_BYTES,
      signal,
      session.readBlockSize,
    );
    out.set(part, off);
    onSlice();
  }
  return out;
}

/**
 * Check LocalInfo `+0x00/+0x01`, then read every vital unit twice. Echoed addresses are validated per frame by
 * the read path. Throws {@link AtD890VitalMismatchError} when the passes differ.
 */
export async function readAtD890VitalUnits(
  session: AtD890VitalReadSession,
  opts: AtD890VitalReadOptions = {},
): Promise<AtD890VitalReadResult> {
  throwIfAborted(opts.signal);
  const head = await atD890ReadMemory(
    session.pipe,
    D890_MAP.LocalInfo,
    AT_D890_BLOCK_SIZE,
    opts.signal,
    AT_D890_BLOCK_SIZE,
  );
  try {
    assertAtD890NoStunKill(head);
  } catch (err) {
    session.abandonProgramMode();
    throw err;
  }

  const passes = 2;
  const slicesPerUnit = AT_D890_VITAL_UNIT_BYTES / SLICE_BYTES;
  const max = AT_D890_VITAL_UNITS.length * slicesPerUnit * passes;
  let cur = 0;
  const results: Uint8Array[][] = [];
  for (let pass = 0; pass < passes; pass++) {
    const stage = pass === 0 ? 'First read' : 'Second read';
    const bytes: Uint8Array[] = [];
    for (const def of AT_D890_VITAL_UNITS) {
      bytes.push(
        await readUnit(
          session,
          def,
          () => {
            cur += 1;
            reportProgress(
              opts.onProgress,
              { cur, max, msg: `${stage}: ${def.label}`, stage },
              opts.signal,
            );
          },
          opts.signal,
        ),
      );
    }
    results.push(bytes);
  }

  const bad = AT_D890_VITAL_UNITS.filter(
    (_, i) => !bytesEqual(results[0]![i]!, results[1]![i]!),
  ).map((d) => d.id);
  if (bad.length > 0) throw new AtD890VitalMismatchError(bad);

  return {
    units: AT_D890_VITAL_UNITS.map((def, i) => ({ def, bytes: results[0]![i]! })),
    bothReadsMatched: true,
  };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export interface AtD890NonFfRange {
  /** Offset within the unit. */
  start: number;
  /** Exclusive end offset. */
  end: number;
}

/**
 * Ranges of a unit that are not `FF`, merged at 16-byte granularity. The last 4 bytes of each unit hold the
 * `55 55 AA AA` live marker and are ignored: "all FF" is the wrong emptiness test (hardware, #1288).
 */
export function listAtD890NonFfRanges(unit: Uint8Array): AtD890NonFfRange[] {
  const limit = Math.max(0, unit.length - 4);
  const ranges: AtD890NonFfRange[] = [];
  for (let off = 0; off < limit; off += AT_D890_BLOCK_SIZE) {
    const end = Math.min(limit, off + AT_D890_BLOCK_SIZE);
    let used = false;
    for (let i = off; i < end; i++) {
      if (unit[i] !== 0xff) {
        used = true;
        break;
      }
    }
    if (!used) continue;
    const last = ranges[ranges.length - 1];
    if (last && last.end === off) last.end = end;
    else ranges.push({ start: off, end });
  }
  return ranges;
}
