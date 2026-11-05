/**
 * Low-level digital contact bank upload for AT-D890UV (#992 / #994, #1406).
 *
 * Separate from `AtD890uvProtocol.upload()`. Every contact erase unit a Write touches is
 * Studio-owned: it starts from `0xFF`, the packer's chunks are overlaid, all-`0xFF` blocks are
 * skipped, and no byte of the unit is read. The official CPS does the same (it erases these
 * units on every contact write), and it keeps a Write free of any `R` after the first `W`.
 */

import type { IdDatabaseFields } from '@core/models/radioBuild.ts';
import type { BytePipe, ProgressFn } from '../../types.ts';
import { AT_D890_BLOCK_SIZE } from './constants.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import { atD890WriteMemory } from './connection.ts';
import { gateAtD890Write } from './programSession.ts';
import { isAtD890DigitalContactUnit } from './digitalContactUnits.ts';
import { AT_D890_ERASE_UNIT_BYTES, eraseUnitBaseFor } from './eraseUnits.ts';
import {
  eraseAnchorsFromModelled,
  listEraseOnlyChunks,
  listSparseStagingChunks,
  overlayModelledChunksOntoUnit,
  type AtD890StagingChunk,
} from './sparseEraseRmw.ts';
import { assertAtD890SpanNotHardDenied, assertAtD890TransmitAddress } from './writableExtents.ts';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import { packAtD890DigitalContacts } from './digitalContactCodec.ts';

const EMPTY_ADDRESSES: ReadonlySet<number> = new Set();

function assertContactUnit(address: number): void {
  const unit = eraseUnitBaseFor(address);
  if (!isAtD890DigitalContactUnit(unit)) {
    throw new RadioProtocolError(
      `D890 contact write refused: 0x${address.toString(16)} is in erase unit 0x${unit.toString(16)}, which is not a digital contact unit`,
    );
  }
}

/** Everything the contact Write will send, built and checked without touching the radio. */
export interface AtD890PreparedContactWrite {
  /** Frames to send, ascending, one run per erase unit. */
  readonly chunks: readonly AtD890StagingChunk[];
  /** Erase units the Write visits, ascending. */
  readonly units: readonly number[];
  /** Lowest modelled address per unit: where an erase-only `FF` block goes (pending units). */
  readonly anchors: ReadonlyMap<number, number>;
}

/**
 * Group chunks by erase unit in one pass (#1558). Replaces a filter over every chunk once per
 * unit (units x chunks predicate calls). Chunks keep their order inside a unit.
 */
export function bucketChunksByUnit(
  chunks: readonly AtD890StagingChunk[],
): Map<number, AtD890StagingChunk[]> {
  const byUnit = new Map<number, AtD890StagingChunk[]>();
  for (const c of chunks) {
    const unit = eraseUnitBaseFor(c.address);
    const bucket = byUnit.get(unit);
    if (bucket) bucket.push(c);
    else byUnit.set(unit, [c]);
  }
  return byUnit;
}

/** Bytes a prepared contact Write sends: one 16-byte block per frame. */
export function preparedContactWriteBytes(prepared: AtD890PreparedContactWrite): number {
  return prepared.chunks.length * AT_D890_BLOCK_SIZE;
}

/**
 * Pack and validate. Every check that can throw runs here, so a caller can do this before the
 * first `W` of a PROGRAM session and never fail mid-write for a reason known up front.
 */
export function prepareAtD890DigitalContactWrite(
  contacts: readonly RadioDigitalContactDto[],
  fields: IdDatabaseFields,
): AtD890PreparedContactWrite {
  const modelledChunks = packAtD890DigitalContacts(contacts, fields).stagingChunks;
  if (modelledChunks.length === 0) return { chunks: [], units: [], anchors: new Map() };

  for (const c of modelledChunks) {
    assertAtD890SpanNotHardDenied(c.address, c.data.length);
    assertContactUnit(c.address);
  }
  const byUnit = bucketChunksByUnit(modelledChunks);
  const units = [...byUnit.keys()].sort((a, b) => a - b);
  const touchedUnitSet = new Set(units);

  // Studio owns these units outright: start from erased flash, never from a read. One unit at a
  // time, so only one 256 KiB buffer is built at once; the staged blocks are views of it.
  const chunks: AtD890StagingChunk[] = [];
  for (const unitBase of units) {
    const buffer = new Uint8Array(AT_D890_ERASE_UNIT_BYTES).fill(0xff);
    const unitChunks = byUnit.get(unitBase)!;
    overlayModelledChunksOntoUnit(unitBase, buffer, unitChunks);
    // A block is modelled when a chunk covers it: a flag per block instead of a set of addresses.
    const modelled = new Uint8Array(AT_D890_ERASE_UNIT_BYTES / AT_D890_BLOCK_SIZE);
    for (const c of unitChunks) modelled[(c.address - unitBase) / AT_D890_BLOCK_SIZE] = 1;
    const staged = listSparseStagingChunks(new Map([[unitBase, buffer]]), EMPTY_ADDRESSES, false);
    for (const c of staged) {
      if (!modelled[(c.address - unitBase) / AT_D890_BLOCK_SIZE]) {
        throw new RadioProtocolError(
          `D890 contact write staged an unmodelled block at 0x${c.address.toString(16)}`,
        );
      }
      assertAtD890TransmitAddress(c.address, touchedUnitSet);
      assertContactUnit(c.address);
      chunks.push(c);
    }
  }
  return { chunks, units, anchors: eraseAnchorsFromModelled(modelledChunks) };
}

/** Send a prepared contact Write. Sends only `W` frames. */
export async function writePreparedAtD890DigitalContacts(
  pipe: BytePipe,
  prepared: AtD890PreparedContactWrite,
  opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {},
): Promise<void> {
  // Contacts alone (no codeplug upload before them): the pending-units gate runs here, before
  // the first W. Already passed when a codeplug upload ran first in this session (#1406).
  const mustRewrite = gateAtD890Write(pipe, prepared.units);
  const touchedUnitSet = new Set(prepared.units);
  const transmitGuard = (address: number) => {
    assertAtD890TransmitAddress(address, touchedUnitSet);
    assertContactUnit(address);
  };
  // A pending unit whose blocks are all FF would not be entered: erase it with one FF block.
  const chunks = [
    ...prepared.chunks,
    ...listEraseOnlyChunks(
      mustRewrite.filter((u) => touchedUnitSet.has(u)),
      prepared.chunks,
      prepared.anchors,
    ),
  ].sort((a, b) => a.address - b.address);
  for (let i = 0; i < chunks.length; i++) {
    throwIfAborted(opts.signal);
    const { address, data } = chunks[i]!;
    reportProgress(
      opts.onProgress,
      {
        cur: i + 1,
        max: chunks.length,
        msg: `Writing digital contacts 0x${address.toString(16)}`,
        stage: 'Digital contacts',
      },
      opts.signal,
    );
    await atD890WriteMemory(pipe, address, data, opts.signal, { transmitGuard });
  }
}

export async function uploadAtD890DigitalContacts(
  pipe: BytePipe,
  contacts: readonly RadioDigitalContactDto[],
  fields: IdDatabaseFields,
  opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {},
): Promise<void> {
  await writePreparedAtD890DigitalContacts(
    pipe,
    prepareAtD890DigitalContactWrite(contacts, fields),
    opts,
  );
}
