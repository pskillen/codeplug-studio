import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import {
  encodeAtD890ChannelRecord,
  encodeChannelsIntoAtD890Image,
  parseAtD890ChannelRecord,
} from './channelCodec.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { AT_D890_LIMITS, AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import { setBitmapBit } from './bitmap.ts';

describe('encodeAtD890ChannelRecord', () => {
  it('round-trips a simple FM channel', () => {
    const ch: RadioChannelDto = {
      slotIndex: 1,
      empty: false,
      wireName: 'Test CH',
      rxHz: 145_520_000,
      txHz: 145_520_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'FM',
      mode: 'analog',
    };
    const encoded = encodeAtD890ChannelRecord(ch);
    expect(encoded.length).toBe(0x80);
    expect([...encoded.subarray(0, 4)]).toEqual([0x14, 0x55, 0x20, 0x00]);
    const decoded = parseAtD890ChannelRecord(encoded, 1);
    expect(decoded.rxHz).toBe(145_520_000);
    expect(decoded.wireName).toBe('Test CH');
    expect(decoded.powerPercent).toBe(100);
  });

  it('round-trips colour code and CTCSS indices', () => {
    const ch: RadioChannelDto = {
      slotIndex: 5,
      empty: false,
      wireName: 'DMR',
      rxHz: 430_125_000,
      txHz: 430_125_000,
      rxTone: { kind: 'ctcss', hz: 88.5 },
      txTone: { kind: 'ctcss', hz: 88.5 },
      powerPercent: 100,
      bandwidth: 'FM',
      mode: 'digital',
      colorCode: 0x11,
    };
    const encoded = encodeAtD890ChannelRecord(ch);
    expect(encoded[0x20]).toBe(0x11);
    expect(encoded[0x43]).toBe(0x11);
    expect(encoded[0x0a]).toBe(9);
    expect(encoded[0x0b]).toBe(9);
    const decoded = parseAtD890ChannelRecord(encoded, 5);
    expect(decoded.colorCode).toBe(0x11);
    expect(decoded.rxTone).toEqual({ kind: 'ctcss', hz: 88.5 });
    expect(decoded.txTone).toEqual({ kind: 'ctcss', hz: 88.5 });
  });

  it('RMW preserves unmodelled bytes when prior is supplied', () => {
    const prior = new Uint8Array(0x80);
    prior[0x22] = 0xab;
    prior.set([0x43, 0x01, 0x25, 0x00], 0);
    const encoded = encodeAtD890ChannelRecord(
      {
        slotIndex: 1,
        empty: false,
        wireName: 'Keep',
        rxHz: 430_125_000,
        txHz: 430_125_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
        mode: 'digital',
      },
      prior,
    );
    expect(encoded[0x22]).toBe(0xab);
  });

  it('encodes DCS tones', () => {
    const ch: RadioChannelDto = {
      slotIndex: 2,
      empty: false,
      wireName: 'DCS',
      rxHz: 430_000_000,
      txHz: 430_000_000,
      rxTone: { kind: 'dcs', code: 123, polarity: 'N' },
      txTone: { kind: 'dcs', code: 456, polarity: 'I' },
      powerPercent: 50,
      bandwidth: 'NFM',
      mode: 'digital',
      timeslot: 2,
    };
    const encoded = encodeAtD890ChannelRecord(ch);
    const decoded = parseAtD890ChannelRecord(encoded, 2);
    expect(decoded.rxTone).toEqual({ kind: 'dcs', code: 123, polarity: 'N' });
    expect(decoded.txTone).toEqual({ kind: 'dcs', code: 456, polarity: 'I' });
    expect(decoded.timeslot).toBe(2);
  });

  it('preserves ChannelSet bits at or above MAX_CHANNELS on Write', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    const set = image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
    setBitmapBit(set, 4000, true);
    setBitmapBit(set, 4001, true);
    image.set(D890_MAP.ChannelSet, set);

    encodeChannelsIntoAtD890Image(image, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'CH1',
        rxHz: 145_520_000,
        txHz: 145_520_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
        mode: 'analog',
      },
    ]);

    const after = image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
    expect((after[500]! & 0x01) !== 0).toBe(true); // bit 4000
    expect((after[500]! & 0x02) !== 0).toBe(true); // bit 4001
    expect((after[0]! & 0x01) !== 0).toBe(true); // bit 0 set for channel 1
  });

  it('returns empty record for vacant slot', () => {
    const encoded = encodeAtD890ChannelRecord({
      slotIndex: 3,
      empty: true,
      wireName: '',
      rxHz: 0,
      txHz: 0,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: null,
      bandwidth: 'FM',
    });
    expect(encoded[0]).toBe(0);
    expect(encoded[1]).toBe(0);
  });
});
