/**
 * Low-level digital contact bank upload for AT-D890UV (#992 / #994).
 *
 * Separate from `AtD890uvProtocol.upload()` — block-hopped bank uses the same sparse
 * erase-unit RMW helpers as satellite keps (`sparseEraseRmw.ts`).
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
} from './sparseEraseRmw.ts';
import { assertAtD890TransmitAddress } from './writableExtents.ts';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import { packAtD890DigitalContacts } from './digitalContactCodec.ts';

export async function uploadAtD890DigitalContacts(
  pipe: BytePipe,
  contacts: readonly RadioDigitalContactDto[],
  opts: { readBlockSize?: number; onProgress?: ProgressFn; signal?: AbortSignal } = {},
): Promise<void> {
  const pack = packAtD890DigitalContacts(contacts);
  const modelledChunks = pack.stagingChunks;
  if (modelledChunks.length === 0) return;

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
        stage: 'Preserving untouched contact data',
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
        msg: `Writing digital contacts 0x${address.toString(16)}`,
        stage: 'Digital contacts',
      },
      opts.signal,
    );
    await atD890WriteMemory(pipe, address, data, opts.signal, { transmitGuard });
  }
}
