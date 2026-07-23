import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import {
  decodeBcdFrequencyHz,
  encodeBcdFrequencyHz,
  encodeDm32ChannelRecord,
  parseDm32ChannelRecord,
} from './channelCodec.ts';
import { DM32_CHANNEL_RECORD_SIZE } from './constants.ts';

describe('dm32 channelCodec', () => {
  it('round-trips BCD frequency Hz', () => {
    const hz = 145_500_000;
    expect(decodeBcdFrequencyHz(encodeBcdFrequencyHz(hz))).toBe(hz);
  });

  it('parses and encodes a basic analog channel record', () => {
    const encoded = encodeDm32ChannelRecord({
      slotIndex: 1,
      empty: false,
      wireName: 'TEST',
      rxHz: 145_500_000,
      txHz: 145_500_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'FM',
      mode: 'analog',
    });
    expect(encoded.length).toBe(DM32_CHANNEL_RECORD_SIZE);
    const parsed = parseDm32ChannelRecord(encoded, 1);
    expect(parsed.empty).toBe(false);
    expect(parsed.wireName).toBe('TEST');
    expect(parsed.rxHz).toBe(145_500_000);
    expect(parsed.bandwidth).toBe('FM');
    expect(parsed.mode).toBe('analog');
  });

  it('treats all-0xFF as empty', () => {
    const blank = new Uint8Array(DM32_CHANNEL_RECORD_SIZE);
    blank.fill(0xff);
    expect(parseDm32ChannelRecord(blank, 3).empty).toBe(true);
  });
});

describe('createMemoryMap smoke', () => {
  it('allocates', () => {
    expect(createMemoryMap(16).size).toBe(16);
  });
});
