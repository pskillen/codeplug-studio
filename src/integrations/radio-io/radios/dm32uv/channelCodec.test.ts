import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  decodeBcdFrequencyHz,
  encodeBcdFrequencyHz,
  encodeChannelsIntoDm32Image,
  encodeDm32ChannelRecord,
  isRxInNoTxBand,
  parseDm32ChannelRecord,
} from './channelCodec.ts';
import { DM32_CHANNEL_RECORD_SIZE, DM32_METADATA } from './constants.ts';
import { encodeTxContactEntry } from './txContactCodec.ts';

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(
    hex
      .trim()
      .split(/\s+/)
      .map((b) => parseInt(b, 16)),
  );
}

function sampleDto(overrides: Partial<RadioChannelDto> = {}): RadioChannelDto {
  return {
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
    ...overrides,
  };
}

// Golden bytes from NeonPlug encodeChannel + createDefaultChannel (structures.ts).
const NEONPLUG_ANALOG_GOLDEN = hexToBytes(
  '54 45 53 54 00 ff ff ff ff ff ff ff ff ff ff ff 00 00 55 14 00 00 55 14 04 80 00 00 30 00 ff 00 ff 00 00 00 00 00 00 50 00 00 00 ff ff ff ff ff',
);
const NEONPLUG_DIGITAL_GOLDEN = hexToBytes(
  '44 4d 52 2d 54 47 39 00 ff ff ff ff ff ff ff ff 50 12 06 43 50 12 06 43 18 00 00 00 30 11 ff 02 ff 00 00 00 00 00 00 50 00 00 00 ff ff ff ff ff',
);
const NEONPLUG_AIRBAND_GOLDEN = hexToBytes(
  '41 49 52 00 ff ff ff ff ff ff ff ff ff ff ff ff 00 00 80 11 ff ff ff ff 0c 80 00 00 30 00 ff 00 ff 00 00 00 00 00 00 50 00 00 00 ff ff ff ff ff',
);

describe('dm32 channelCodec', () => {
  it('round-trips BCD frequency Hz', () => {
    const hz = 145_500_000;
    expect(decodeBcdFrequencyHz(encodeBcdFrequencyHz(hz))).toBe(hz);
  });

  it('isRxInNoTxBand matches NeonPlug 87–136 MHz rule', () => {
    expect(isRxInNoTxBand(87_000_000)).toBe(true);
    expect(isRxInNoTxBand(118_000_000)).toBe(true);
    expect(isRxInNoTxBand(135_999_000)).toBe(true);
    expect(isRxInNoTxBand(86_999_000)).toBe(false);
    expect(isRxInNoTxBand(136_000_000)).toBe(false);
  });

  it('encodes empty slot as all 0xFF', () => {
    const rec = encodeDm32ChannelRecord(sampleDto({ empty: true, rxHz: 0 }));
    expect(rec.every((b) => b === 0xff)).toBe(true);
    expect(parseDm32ChannelRecord(rec, 3).empty).toBe(true);
  });

  it('matches NeonPlug golden bytes for default-rich analog channel', () => {
    const encoded = encodeDm32ChannelRecord(
      sampleDto({
        wireName: 'TEST',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        powerPercent: 100,
        bandwidth: 'FM',
        mode: 'analog',
      }),
    );
    expect(Array.from(encoded)).toEqual(Array.from(NEONPLUG_ANALOG_GOLDEN));
  });

  it('matches NeonPlug golden bytes for digital channel with forbid TX', () => {
    const encoded = encodeDm32ChannelRecord(
      sampleDto({
        slotIndex: 2,
        wireName: 'DMR-TG9',
        rxHz: 430_612_500,
        txHz: 430_612_500,
        powerPercent: 20,
        bandwidth: 'NFM',
        mode: 'digital',
        colorCode: 1,
        timeslot: 2,
        rxGroupIndex: 2,
        rxOnly: true,
      }),
    );
    expect(Array.from(encoded)).toEqual(Array.from(NEONPLUG_DIGITAL_GOLDEN));
  });

  it('matches NeonPlug golden bytes for aviation receive-only (TX FF×4)', () => {
    const encoded = encodeDm32ChannelRecord(
      sampleDto({
        wireName: 'AIR',
        rxHz: 118_000_000,
        txHz: 118_000_000,
        bandwidth: 'FM',
        mode: 'analog',
        rxOnly: true,
      }),
    );
    expect(Array.from(encoded)).toEqual(Array.from(NEONPLUG_AIRBAND_GOLDEN));
    expect(encoded[0x14]).toBe(0xff);
    expect(encoded[0x18] & 0x08).toBe(0x08);
  });

  it('round-trips rxOnly from 0x18 bit 3', () => {
    const encoded = encodeDm32ChannelRecord(sampleDto({ rxOnly: true }));
    expect(parseDm32ChannelRecord(encoded, 1).rxOnly).toBe(true);
  });

  it('encodes zone-derived scanListId and scanAdd on byte 0x19', () => {
    const list1 = encodeDm32ChannelRecord(
      sampleDto({ bandwidth: 'NFM', scanAdd: true, scanListId: 1 }),
    );
    expect(list1[0x19]).toBe(0x44);

    const list2 = encodeDm32ChannelRecord(
      sampleDto({ bandwidth: 'NFM', scanAdd: true, scanListId: 2 }),
    );
    expect(list2[0x19]).toBe(0x48);
    expect(list2[0x19]! & 0x80).toBe(0);
    expect(list2[0x19]! & 0x40).toBe(0x40);
    expect((list2[0x19]! >> 2) & 0x0f).toBe(2);
  });

  it('parses and encodes a basic analog channel record', () => {
    const encoded = encodeDm32ChannelRecord(sampleDto());
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

  it('encodeChannelsIntoDm32Image clears unused slots and TX contacts', () => {
    const addressBase = 0x10_000;
    const image = createMemoryMap(0x30_000);
    const channelBlockCount = 2;
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

    const firstOff = addressBase - addressBase;
    image.bytes[firstOff] = 3;
    image.bytes[firstOff + 1] = 0;

    const staleName = new TextEncoder().encode('OLD');
    const staleRecord = new Uint8Array(DM32_CHANNEL_RECORD_SIZE);
    staleRecord.fill(0xff);
    staleRecord.set(staleName, 0);
    staleRecord[staleName.length] = 0;
    staleRecord.set(encodeBcdFrequencyHz(433_000_000), 0x10);
    staleRecord.set(encodeBcdFrequencyHz(433_000_000), 0x14);
    image.set(firstOff + 0x10 + 2 * DM32_CHANNEL_RECORD_SIZE, staleRecord);

    const txLowBase = 0x20_000;
    const [staleTx0, staleTx1] = encodeTxContactEntry(99, true);
    image.bytes[txLowBase + 2] = staleTx0;
    image.bytes[txLowBase + 3] = staleTx1;

    encodeChannelsIntoDm32Image(image, cache, [
      sampleDto({ slotIndex: 1, wireName: 'ONE', txContactId: 5, mode: 'digital' }),
    ]);

    const slot3Off = firstOff + 0x10 + 2 * DM32_CHANNEL_RECORD_SIZE;
    expect(image.bytes[slot3Off]).toBe(0xff);
    expect(parseDm32ChannelRecord(image.get(slot3Off, DM32_CHANNEL_RECORD_SIZE), 3).empty).toBe(
      true,
    );

    const [clearedTx0, clearedTx1] = encodeTxContactEntry(0, false);
    expect(image.bytes[txLowBase + 2]).toBe(clearedTx0);
    expect(image.bytes[txLowBase + 3]).toBe(clearedTx1);

    const [activeTx0, activeTx1] = encodeTxContactEntry(5, true);
    expect(image.bytes[txLowBase]).toBe(activeTx0);
    expect(image.bytes[txLowBase + 1]).toBe(activeTx1);

    expect(image.bytes[firstOff]).toBe(1);
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
