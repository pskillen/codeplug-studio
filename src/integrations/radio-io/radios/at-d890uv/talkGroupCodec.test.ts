import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import type { MemoryMap } from '../../types.ts';
import { D890_MAP } from './constants.ts';
import {
  encodeAtD890TalkgroupOrder,
  encodeAtD890TalkgroupRecord,
  encodeTalkgroupsIntoAtD890Image,
} from './talkGroupCodec.ts';

describe('encodeAtD890TalkgroupRecord', () => {
  it('encodes Local 99 as BCD-as-hex 00 00 00 99, not binary 00 00 00 63', () => {
    const record = encodeAtD890TalkgroupRecord({
      index: 1,
      wireName: 'Local 99',
      digitalId: 99,
      callType: 0x04,
    });
    expect(record[0]).toBe(0x01);
    expect([...record.subarray(0x2, 0x6)]).toEqual([0x00, 0x00, 0x00, 0x99]);
    expect([...record.subarray(0x2, 0x6)]).not.toEqual([0x00, 0x00, 0x00, 0x63]);
  });

  it('maps NeonPlug group call type 0x04 to Anytone 0x01', () => {
    const record = encodeAtD890TalkgroupRecord({
      index: 1,
      wireName: 'TG',
      digitalId: 9,
      callType: 0x04,
    });
    expect(record[0]).toBe(0x01);
  });

  it('encodes Scotland West DMR ID 23559 as 00 02 35 59', () => {
    const record = encodeAtD890TalkgroupRecord({
      index: 1,
      wireName: 'Scotland West',
      digitalId: 23_559,
      callType: 0x04,
    });
    expect([...record.subarray(0x2, 0x6)]).toEqual([0x00, 0x02, 0x35, 0x59]);
  });

  it('maps NeonPlug private and all call types', () => {
    expect(
      encodeAtD890TalkgroupRecord({
        index: 1,
        wireName: 'P',
        digitalId: 1,
        callType: 0x03,
      })[0],
    ).toBe(0x00);
    expect(
      encodeAtD890TalkgroupRecord({
        index: 1,
        wireName: 'A',
        digitalId: 1,
        callType: 0x05,
      })[0],
    ).toBe(0x02);
  });

  it('passes through already-Anytone call types including private 0', () => {
    expect(
      encodeAtD890TalkgroupRecord({
        index: 1,
        wireName: 'P',
        digitalId: 1,
        callType: 0,
      })[0],
    ).toBe(0x00);
  });

  it('rebuilds TalkgroupOrder as little-endian BCD keys and 0-based slots', () => {
    const order = encodeAtD890TalkgroupOrder([
      { index: 2, wireName: 'TG2', digitalId: 9, callType: 0x04 },
      { index: 1, wireName: 'TG1', digitalId: 99, callType: 0x04 },
    ]);
    expect(order.length).toBe(16);
    expect([...order.subarray(0, 8)]).toEqual([0x13, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
    expect([...order.subarray(8, 16)]).toEqual([0x33, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  });

  it('keeps the first private or all-call when they share a BCD key', () => {
    const order = encodeAtD890TalkgroupOrder([
      { index: 2, wireName: 'P', digitalId: 9, callType: 0x03 },
      { index: 4, wireName: 'A', digitalId: 9, callType: 0x05 },
    ]);
    expect([...order.subarray(0, 8)]).toEqual([0x12, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
    expect([...order.subarray(8, 16)]).toEqual([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    expect(order.length).toBe(16);
  });

  it('encodes ID 2351234 group at index 1 as little-endian BCD key 0x046A2469', () => {
    const order = encodeAtD890TalkgroupOrder([
      { index: 1, wireName: 'Wide', digitalId: 2_351_234, callType: 0x04 },
    ]);
    expect([...order.subarray(0, 8)]).toEqual([0x69, 0x24, 0x6a, 0x04, 0x00, 0x00, 0x00, 0x00]);
  });
});

function positionWord(image: MemoryMap, index: number): number[] {
  return [...image.get(D890_MAP.TalkgroupPosition + index * 4, 4)];
}

describe('encodeTalkgroupsIntoAtD890Image', () => {
  it('writes the identity position table for the talk groups just stored', () => {
    const image = createMemoryMap(0x500_0000);
    encodeTalkgroupsIntoAtD890Image(image, [
      { index: 1, wireName: 'A', digitalId: 9, callType: 0x04 },
      { index: 2, wireName: 'B', digitalId: 99, callType: 0x04 },
      { index: 3, wireName: 'C', digitalId: 235, callType: 0x04 },
    ]);
    expect(positionWord(image, 0)).toEqual([0x00, 0x00, 0x00, 0x00]);
    expect(positionWord(image, 1)).toEqual([0x01, 0x00, 0x00, 0x00]);
    expect(positionWord(image, 2)).toEqual([0x02, 0x00, 0x00, 0x00]);
    expect(positionWord(image, 3)).toEqual([0xff, 0xff, 0xff, 0xff]);
    expect(positionWord(image, AT_D890UV_LIMITS.TALK_GROUPS_MAX - 1)).toEqual([
      0xff, 0xff, 0xff, 0xff,
    ]);
  });

  it('fills the position table with 0xffffffff when no talk group is written', () => {
    const image = createMemoryMap(0x500_0000);
    encodeTalkgroupsIntoAtD890Image(image, []);
    expect(positionWord(image, 0)).toEqual([0xff, 0xff, 0xff, 0xff]);
  });

  it('extends the position prefix through a hole so every written slot is inside it', () => {
    const image = createMemoryMap(0x500_0000);
    encodeTalkgroupsIntoAtD890Image(image, [
      { index: 1, wireName: 'A', digitalId: 9, callType: 0x04 },
      { index: 2, wireName: 'skip', digitalId: 0, callType: 0x04 },
      { index: 3, wireName: 'C', digitalId: 99, callType: 0x04 },
    ]);
    expect(positionWord(image, 0)).toEqual([0x00, 0x00, 0x00, 0x00]);
    expect(positionWord(image, 1)).toEqual([0x01, 0x00, 0x00, 0x00]);
    expect(positionWord(image, 2)).toEqual([0x02, 0x00, 0x00, 0x00]);
    expect(positionWord(image, 3)).toEqual([0xff, 0xff, 0xff, 0xff]);
  });

  it('leaves the byte after the talkgroup order payload at 0xff', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    const talkGroups = [{ index: 1, wireName: 'TG', digitalId: 99, callType: 0x04 }];
    encodeTalkgroupsIntoAtD890Image(image, talkGroups);
    const order = encodeAtD890TalkgroupOrder(talkGroups);
    expect(image.get(D890_MAP.TalkgroupOrder + order.length, 1)[0]).toBe(0xff);
  });
});
