import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import { radioIdAddress, applyAtD890WriteImageToCache, listWriteChunks } from './memory.ts';
import { encodeAtD890RadioIdRecord, encodeRadioIdsIntoAtD890Image } from './radioIdCodec.ts';
import { assembleAtD890WriteImage } from './hydration.ts';
import { AT_D890_ERASE_UNIT_BYTES, eraseUnitBaseFor } from './eraseUnits.ts';
import { listSparseStagingChunks, overlayModelledChunksOntoUnit } from './sparseEraseRmw.ts';

describe('encodeRadioIdsIntoAtD890Image', () => {
  it('retains hydrated RadioId bank when projection is empty', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(0, AT_D890_MAP_SIZE, 0xff);
    const set = new Uint8Array(AT_D890_LIMITS.RADIO_ID_SET_BYTES);
    setBitmapBit(set, 0, true);
    image.set(D890_MAP.RadioIdSet, set);
    const record = encodeAtD890RadioIdRecord({ index: 0, dmrId: 2_345_678, name: 'MM9PDY' });
    image.set(radioIdAddress(0), record);

    encodeRadioIdsIntoAtD890Image(image, []);
    encodeRadioIdsIntoAtD890Image(image, [{ index: 0, dmrId: 0, name: '' }]);

    expect(image.get(D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES)[0]).toBe(set[0]);
    expect([...image.get(radioIdAddress(0), AT_D890_LIMITS.RADIO_ID_STRIDE)]).toEqual([...record]);
  });

  it('clears virgin 0xff RadioIdSet when the projection has no IDs', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(0, AT_D890_MAP_SIZE, 0xff);

    encodeRadioIdsIntoAtD890Image(image, []);
    encodeRadioIdsIntoAtD890Image(image, [{ index: 0, dmrId: 0, name: '' }]);

    const set = image.get(D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES);
    expect(set.every((b) => b === 0)).toBe(true);
  });

  it('full-replaces RadioId bank when projection has entries', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(0, AT_D890_MAP_SIZE, 0xff);
    const oldSet = new Uint8Array(AT_D890_LIMITS.RADIO_ID_SET_BYTES);
    setBitmapBit(oldSet, 1, true);
    image.set(D890_MAP.RadioIdSet, oldSet);
    image.set(radioIdAddress(1), encodeAtD890RadioIdRecord({ index: 1, dmrId: 111, name: 'Old' }));

    encodeRadioIdsIntoAtD890Image(image, [{ index: 0, dmrId: 999, name: 'New' }]);

    const set = image.get(D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES);
    expect(set[0]! & 0x01).toBe(0x01);
    expect(set[0]! & 0x02).toBe(0);
    const body = image.get(radioIdAddress(0), AT_D890_LIMITS.RADIO_ID_STRIDE);
    expect([...body.subarray(0, 4)]).toEqual([
      ...encodeAtD890RadioIdRecord({ index: 0, dmrId: 999, name: 'New' }).subarray(0, 4),
    ]);
  });
});

describe('assemble RadioIdSet staging', () => {
  it('stages cleared RadioIdSet zeros so unit 0x3480000 RMW does not skip them', () => {
    const image = assembleAtD890WriteImage([
      {
        slotIndex: 1,
        empty: false,
        wireName: 'CH1',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
        mode: 'analog',
      },
    ]);
    const cache = { blocks: new Map<number, Uint8Array>() };
    applyAtD890WriteImageToCache(cache, image);
    const chunks = listWriteChunks(cache);
    const ridEnd = D890_MAP.RadioIdSet + AT_D890_LIMITS.RADIO_ID_SET_BYTES;
    const ridChunks = chunks.filter((c) => c.address >= D890_MAP.RadioIdSet && c.address < ridEnd);
    expect(ridChunks.length).toBeGreaterThan(0);
    expect(ridChunks.every((c) => c.data.every((b) => b === 0))).toBe(true);

    const unitBase = eraseUnitBaseFor(D890_MAP.RadioIdSet);
    expect(unitBase).toBe(0x348_0000);
    const unit = new Uint8Array(AT_D890_ERASE_UNIT_BYTES).fill(0xff);
    overlayModelledChunksOntoUnit(unitBase, unit, ridChunks);
    const staged = listSparseStagingChunks(
      new Map([[unitBase, unit]]),
      new Set(ridChunks.map((c) => c.address)),
    );
    const stagedRid = staged.filter((c) => c.address >= D890_MAP.RadioIdSet && c.address < ridEnd);
    expect(stagedRid.length).toBe(ridChunks.length);
    expect(stagedRid.every((c) => c.data.every((b) => b === 0))).toBe(true);
  });
});
