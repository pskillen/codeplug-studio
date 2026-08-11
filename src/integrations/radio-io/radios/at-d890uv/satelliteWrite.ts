/**
 * Low-level satellite keps upload for the AT-D890UV (#856).
 *
 * Deliberately does **not** go through `AtD890uvProtocol.upload()` — see the design-decision
 * note in `src/app/services/radioIoAtD890SatelliteWrite.ts` for why. This module reuses the
 * same generic, already-hardened erase-unit RMW building blocks `upload()` itself uses
 * (`sparseEraseRmw.ts`, `eraseUnits.ts`) plus the low-level read/write frame primitives
 * (`connection.ts`), without re-implementing PROGRAM-session framing (the caller's
 * `RadioSession` is already in PROGRAM mode by the time a satellite write runs — see
 * `AtD890uvProtocol.connect()`).
 */

import type { BytePipe, ProgressFn } from '../../types.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import { atD890ReadMemory, atD890WriteMemory } from './connection.ts';
import { AT_D890_BLOCK_SIZE } from './constants.ts';
import { eraseUnitBaseFor, listTouchedEraseUnits, readSpanForEraseUnit } from './eraseUnits.ts';
import {
  assertPreservedBytesMatchFreshRead,
  listSparseStagingChunks,
  modelledAddressSetFromChunks,
  overlayModelledChunksOntoUnit,
  type AtD890StagingChunk,
} from './sparseEraseRmw.ts';
import { assertAtD890TransmitAddress } from './writableExtents.ts';
import type { SatelliteWriteRecord } from './satelliteCodec.ts';

/** Split one record's bytes into 16-byte-aligned frames at sequential addresses. */
function chunk16(address: number, bytes: Uint8Array): AtD890StagingChunk[] {
  const chunks: AtD890StagingChunk[] = [];
  for (let off = 0; off < bytes.length; off += AT_D890_BLOCK_SIZE) {
    chunks.push({ address: address + off, data: bytes.subarray(off, off + AT_D890_BLOCK_SIZE) });
  }
  return chunks;
}

/**
 * Upload satellite wire records with sparse erase-unit read-modify-write.
 *
 * Every touched erase unit (normally just one — the satellite region is small and
 * erase-unit-aligned) is read fresh first, our records are overlaid onto it in memory, and
 * only the resulting changed (non-`0xff`) 16-byte blocks are transmitted — exactly the same
 * "preserve co-resident bytes" policy `AtD890uvProtocol.upload()` applies elsewhere, reused
 * here via the same generic `sparseEraseRmw.ts` helpers rather than re-implemented.
 */
export async function uploadAtD890SatelliteRecords(
  pipe: BytePipe,
  records: readonly SatelliteWriteRecord[],
  opts: { readBlockSize?: number; onProgress?: ProgressFn; signal?: AbortSignal } = {},
): Promise<void> {
  if (records.length === 0) return;

  const modelledChunks = records.flatMap((r) => chunk16(r.address, r.bytes));
  const modelledAddresses = modelledAddressSetFromChunks(modelledChunks);
  const touchedUnits = listTouchedEraseUnits(modelledChunks.map((c) => c.address));
  const touchedUnitSet = new Set(touchedUnits);
  const readBlockSize = opts.readBlockSize ?? AT_D890_BLOCK_SIZE;

  const freshUnits = new Map<number, Uint8Array>();
  for (let u = 0; u < touchedUnits.length; u++) {
    throwIfAborted(opts.signal);
    const unitBase = touchedUnits[u]!;
    const { start, length } = readSpanForEraseUnit(unitBase);
    reportProgress(
      opts.onProgress,
      {
        cur: u,
        max: touchedUnits.length,
        msg: `Reading erase unit 0x${unitBase.toString(16)}…`,
        stage: 'Preserving untouched satellite data',
      },
      opts.signal,
    );
    const data = await atD890ReadMemory(pipe, start, length, opts.signal, readBlockSize);
    freshUnits.set(unitBase, data);
  }

  const mergedUnits = new Map<number, Uint8Array>();
  for (const [base, data] of freshUnits) {
    mergedUnits.set(base, data.slice());
  }
  for (const unitBase of touchedUnits) {
    const unitChunks = modelledChunks.filter((c) => eraseUnitBaseFor(c.address) === unitBase);
    overlayModelledChunksOntoUnit(unitBase, mergedUnits.get(unitBase)!, unitChunks);
  }

  const stagingChunks = listSparseStagingChunks(mergedUnits, modelledAddresses);
  assertPreservedBytesMatchFreshRead(stagingChunks, freshUnits, modelledAddresses);

  const transmitGuard = (address: number) => assertAtD890TransmitAddress(address, touchedUnitSet);

  for (let i = 0; i < stagingChunks.length; i++) {
    throwIfAborted(opts.signal);
    const { address, data } = stagingChunks[i]!;
    reportProgress(
      opts.onProgress,
      {
        cur: i + 1,
        max: stagingChunks.length,
        msg: `Writing 0x${address.toString(16)}`,
        stage: 'Upload',
      },
      opts.signal,
    );
    await atD890WriteMemory(pipe, address, data, opts.signal, { transmitGuard });
  }
}
