import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
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

  it('rebuilds TalkgroupOrder with sorted keys and 0xff padding', () => {
    const order = encodeAtD890TalkgroupOrder([
      { index: 2, wireName: 'TG2', digitalId: 9, callType: 0x04 },
      { index: 1, wireName: 'TG1', digitalId: 99, callType: 0x04 },
    ]);
    expect(order.length).toBe(32);
    expect([...order.subarray(0, 8)]).toEqual([0x00, 0x00, 0x00, 0x13, 0x00, 0x00, 0x00, 0x02]);
    expect([...order.subarray(8, 16)]).toEqual([0x00, 0x00, 0x00, 0xc7, 0x00, 0x00, 0x00, 0x01]);
    expect(order[16]).toBe(0xff);
  });
});

describe('encodeTalkgroupsIntoAtD890Image', () => {
  it('leaves the byte after the talkgroup order payload at 0xff', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    const talkGroups = [{ index: 1, wireName: 'TG', digitalId: 99, callType: 0x04 }];
    encodeTalkgroupsIntoAtD890Image(image, talkGroups);
    const order = encodeAtD890TalkgroupOrder(talkGroups);
    expect(image.get(D890_MAP.TalkgroupOrder + order.length, 1)[0]).toBe(0xff);
  });
});
