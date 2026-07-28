import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import {
  AT_D890_APRS_CURRENT_CHANNEL_WIRE,
  AT_D890_MAP_SIZE,
  D890_MAP,
} from './constants.ts';
import { encodeAprsIntoAtD890Image, patchAtD890AprsConfigBlock } from './aprsCodec.ts';

describe('aprsCodec', () => {
  it('patches modelled fields and preserves unmodelled bytes', () => {
    const block = new Uint8Array(D890_MAP.AprsConfigMainLength).fill(0xaa);
    block[0x16] = 0x55;

    patchAtD890AprsConfigBlock(block, {
      manualTxIntervalSec: 120,
      autoTxIntervalSec: 180,
      fixedLocationBeacon: 1,
      fixedLatitude: { degrees: 55, minInt: 51, minMark: 30, hemisphere: 0 },
      fixedLongitude: { degrees: 4, minInt: 15, minMark: 0, hemisphere: 0 },
      digitalSlots: [
        {
          reportChannelWire: 5,
          targetDmrId: 12345,
          callType: 1,
          timeslot: 2,
        },
        {
          reportChannelWire: AT_D890_APRS_CURRENT_CHANNEL_WIRE,
          targetDmrId: null,
          callType: 0,
          timeslot: 0,
        },
      ],
    });

    expect(block[0x0a]).toBe(120);
    expect(block[0x0b]).toBe(9); // (9+3)*15 = 180
    expect(block[0x0d]).toBe(1);
    expect(block[0x0e]).toBe(55);
    expect(block[0x11]).toBe(0);
    expect(block[0x12]).toBe(4);
    expect(block[0x16]).toBe(0x55);
    expect(block[0x40]).toBe(5);
    expect(block[0x41]).toBe(0);
    expect(block[0x50]).toBe(0x00);
    expect(block[0x51]).toBe(0x01);
    expect(block[0x52]).toBe(0x23);
    expect(block[0x53]).toBe(0x45);
    expect(block[0x70]).toBe(1);
    expect(block[0x79]).toBe(2);
    expect(block[0x42]).toBe(AT_D890_APRS_CURRENT_CHANNEL_WIRE & 0xff);
    expect(block[0x43]).toBe((AT_D890_APRS_CURRENT_CHANNEL_WIRE >> 8) & 0xff);
  });

  it('encodeAprsIntoAtD890Image writes into memory map', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(D890_MAP.AprsConfigMain, D890_MAP.AprsConfigMainLength, 0xbb);

    encodeAprsIntoAtD890Image(image, {
      manualTxIntervalSec: 60,
    });

    const block = image.get(D890_MAP.AprsConfigMain, D890_MAP.AprsConfigMainLength);
    expect(block[0x0a]).toBe(60);
    expect(block[0x01]).toBe(0xbb);
  });
});
