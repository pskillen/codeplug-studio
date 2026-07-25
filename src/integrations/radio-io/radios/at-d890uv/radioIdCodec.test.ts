import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import { radioIdAddress } from './memory.ts';
import { encodeAtD890RadioIdRecord, encodeRadioIdsIntoAtD890Image } from './radioIdCodec.ts';

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

  it('full-replaces RadioId bank when projection has entries', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(0, AT_D890_MAP_SIZE, 0xff);
    const oldSet = new Uint8Array(AT_D890_LIMITS.RADIO_ID_SET_BYTES);
    setBitmapBit(oldSet, 1, true);
    image.set(D890_MAP.RadioIdSet, oldSet);
    image.set(
      radioIdAddress(1),
      encodeAtD890RadioIdRecord({ index: 1, dmrId: 111, name: 'Old' }),
    );

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
