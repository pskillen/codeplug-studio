import { describe, expect, it } from 'vitest';
import { encodeAtD890ChannelRecord, parseAtD890ChannelRecord } from './channelCodec.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';

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
    const decoded = parseAtD890ChannelRecord(encoded, 1);
    expect(decoded.rxHz).toBe(145_520_000);
    expect(decoded.wireName).toBe('Test CH');
    expect(decoded.powerPercent).toBe(100);
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
