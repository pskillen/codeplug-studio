import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import {
  decodeBcdFrequencyHz,
  encodeBcdFrequencyHz,
  encodeChannelsIntoDm32Image,
  encodeDm32ChannelRecord,
  parseDm32ChannelRecord,
} from './channelCodec.ts';
import { DM32_CHANNEL_RECORD_SIZE, DM32_METADATA } from './constants.ts';
import { encodeTxContactEntry } from './txContactCodec.ts';

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

  it('encodeChannelsIntoDm32Image writes nibble-split TX contact at 2047/2048 boundary', () => {
    const addressBase = 0x10_000;
    const image = createMemoryMap(0x30_000);
    const channelBlockCount = 25;
    const discovered: { address: number; metadata: number }[] = [];
    for (let i = 0; i < channelBlockCount; i++) {
      discovered.push({
        address: addressBase + i * 0x1000,
        metadata: DM32_METADATA.CHANNEL_FIRST + i,
      });
    }
    discovered.push(
      { address: addressBase + 0x20_000, metadata: DM32_METADATA.TX_CONTACT_LOW },
      { address: addressBase + 0x21_000, metadata: DM32_METADATA.TX_CONTACT_HIGH },
    );
    const cache = { addressBase, discovered };

    const baseChannel = {
      empty: false,
      wireName: 'TG',
      rxHz: 145_500_000,
      txHz: 145_500_000,
      rxTone: { kind: 'none' as const },
      txTone: { kind: 'none' as const },
      powerPercent: 100,
      bandwidth: 'NFM' as const,
      mode: 'digital' as const,
      txContactId: 42,
    };

    encodeChannelsIntoDm32Image(image, cache, [
      { ...baseChannel, slotIndex: 2047 },
      { ...baseChannel, slotIndex: 2048, txContactId: 99 },
    ]);

    const txLowBase = addressBase + 0x20_000 - addressBase;
    const txHighBase = addressBase + 0x21_000 - addressBase;
    const lowOff = txLowBase + (2047 - 1) * 2;
    const highOff = txHighBase + (2048 & 0x7ff) * 2;
    const [expLow0, expLow1] = encodeTxContactEntry(42, true);
    const [expHigh0, expHigh1] = encodeTxContactEntry(99, true);

    expect(image.bytes[lowOff]).toBe(expLow0);
    expect(image.bytes[lowOff + 1]).toBe(expLow1);
    expect(image.bytes[highOff]).toBe(expHigh0);
    expect(image.bytes[highOff + 1]).toBe(expHigh1);
  });
});

describe('createMemoryMap smoke', () => {
  it('allocates', () => {
    expect(createMemoryMap(16).size).toBe(16);
  });
});
