import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import {
  encodeAprsIntoDm32Image,
  patchDm32AprsSettingsSlice,
  DM32_APRS_SLICE_START,
  DM32_APRS_SLICE_END,
} from './aprsCodec.ts';
import { encodeDm32ChannelRecord } from './channelCodec.ts';

describe('aprsCodec', () => {
  it('patches APRS slice and preserves neighbouring settings bytes', () => {
    const block = new Uint8Array(DM32_BLOCK_SIZE);
    block.fill(0xaa);
    block[0x300] = 0x11; // just before APRS
    block[0x335] = 0x22; // just after APRS
    block[0xfff] = DM32_METADATA.VFO_SETTINGS;

    patchDm32AprsSettingsSlice(block, {
      reportChannelNumbers: [3, 0, 0, 0, 0, 0, 0, 7],
      scheduledSendTime: 5,
      manualBeacon: true,
      latitude: '51.5',
      latitudeHemisphere: 'N',
      longitude: '0.12',
      longitudeHemisphere: 'W',
      callType: 1,
      uploadDmrId: 0x123456,
    });

    expect(block[0x300]).toBe(0x11);
    expect(block[0x335]).toBe(0x22);
    expect(block[0x301]).toBe(5);
    expect(block[0x302]! & 0x01).toBe(1);
    expect(block[0x30f]).toBe(0x4e);
    expect(block[0x319]).toBe(0x57);
    expect(block[0x320]).toBe(3);
    expect(block[0x321]).toBe(0);
    expect(block[0x32e]).toBe(7);
    expect(block[0x331]! & 0x01).toBe(1);
    expect(block[0x332]).toBe(0x12);
    expect(block[0x333]).toBe(0x34);
    expect(block[0x334]).toBe(0x56);
    // Unspecified mid-slice bytes stay until explicitly written by patch fields
    expect(DM32_APRS_SLICE_START).toBe(0x301);
    expect(DM32_APRS_SLICE_END).toBe(0x334);
  });

  it('encodes APRS into the settings block of a MemoryMap', () => {
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.bytes.fill(0xbb);
    image.bytes[0xfff] = DM32_METADATA.VFO_SETTINGS;
    image.bytes[0x40] = 0x99; // GPS byte outside APRS — must stay

    encodeAprsIntoDm32Image(
      image,
      {
        addressBase: 0,
        discovered: [{ address: 0, metadata: DM32_METADATA.VFO_SETTINGS }],
      },
      {
        reportChannelNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
        scheduledSendTime: 10,
      },
    );

    expect(image.bytes[0x40]).toBe(0x99);
    expect(image.bytes[0x301]).toBe(10);
    expect(image.bytes[0x320]).toBe(1);
    expect(image.bytes[0x322]).toBe(2);
  });
});

describe('channel APRS bits', () => {
  it('sets APRS receive and digital report mode on the channel record', () => {
    const rec = encodeDm32ChannelRecord({
      slotIndex: 1,
      empty: false,
      wireName: 'APRS',
      rxHz: 145_500_000,
      txHz: 145_500_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
      aprsReceive: true,
      aprsReportMode: 'digital',
    });
    expect(rec[0x1a]! & 0x04).toBe(0x04);
    expect((rec[0x1c]! >> 2) & 0x03).toBe(1);
  });
});
