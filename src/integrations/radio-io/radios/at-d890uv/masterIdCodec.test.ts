import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import { encodeMasterIdIntoAtD890Image, isAtD890MasterIdSelected } from './masterIdCodec.ts';

const master = { index: 0, dmrId: 2_351_234, name: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' };

describe('encodeMasterIdIntoAtD890Image', () => {
  it('keeps a seeded +0x26 byte and does not let the name cover it', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    const prior = new Uint8Array(D890_MAP.MasterIdLength);
    prior[0x24] = 0xab;
    prior[0x26] = 0xff;
    prior[0x3f] = 0xcd;
    image.set(D890_MAP.MasterIdData, prior);

    encodeMasterIdIntoAtD890Image(image, [master]);

    const body = image.get(D890_MAP.MasterIdData, D890_MAP.MasterIdLength);
    expect([...body.subarray(0, 4)]).toEqual([0x02, 0x35, 0x12, 0x34]);
    expect([...body.subarray(0, 4)]).not.toEqual([0x00, 0x23, 0xe0, 0x82]);
    expect(body[4]).toBe(0x41);
    expect(body[5]).toBe(0x00);
    // 17th character ('Q') would land at +0x24 if the name were 0x22 bytes.
    expect(body[0x24]).toBe(0xab);
    expect(body[0x24]).not.toBe(0x51);
    // 18th character ('R') would land at +0x26 if the name were the radio-ID length.
    expect(body[0x26]).toBe(0xff);
    expect(body[0x26]).not.toBe(0x52);
    expect(body[0x3f]).toBe(0xcd);
  });

  it('leaves +0x26 zero on a fresh image', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    encodeMasterIdIntoAtD890Image(image, [master]);
    const body = image.get(D890_MAP.MasterIdData, D890_MAP.MasterIdLength);
    expect([...body.subarray(0, 4)]).toEqual([0x02, 0x35, 0x12, 0x34]);
    expect(body[0x26]).toBe(0x00);
  });

  it('does not touch MasterIdData when the projection is empty', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    const prior = new Uint8Array(D890_MAP.MasterIdLength);
    prior[0] = 0xcc;
    prior[0x26] = 0xff;
    image.set(D890_MAP.MasterIdData, prior);

    encodeMasterIdIntoAtD890Image(image, []);
    encodeMasterIdIntoAtD890Image(image, [{ index: 0, dmrId: 0, name: 'X' }]);

    const body = image.get(D890_MAP.MasterIdData, D890_MAP.MasterIdLength);
    expect(body[0]).toBe(0xcc);
    expect(body[0x26]).toBe(0xff);
  });
});

describe('isAtD890MasterIdSelected', () => {
  it('reads the flag at +0x26 (0x03684026)', () => {
    const body = new Uint8Array(D890_MAP.MasterIdLength);
    expect(isAtD890MasterIdSelected(body)).toBe(false);
    body[0x26] = 1;
    expect(isAtD890MasterIdSelected(body)).toBe(true);
    expect(D890_MAP.MasterIdData + 0x26).toBe(0x03684026);
  });
});
