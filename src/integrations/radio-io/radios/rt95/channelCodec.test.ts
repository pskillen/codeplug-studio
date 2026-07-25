import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import {
  decodeChannelRecord,
  decodeChannelsFromImage,
  encodeChannelRecord,
  encodeChannelsIntoImage,
} from './channelCodec.ts';
import { occupiedBitAt, buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import { RT95_CHANNEL_SPAN, RT95_IMAGE_SIZE } from './constants.ts';

function sampleDto(overrides: Partial<RadioChannelDto> = {}): RadioChannelDto {
  return {
    slotIndex: 1,
    empty: false,
    wireName: 'TEST01',
    rxHz: 146_520_000,
    txHz: 146_520_000,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'FM',
    ...overrides,
  };
}

describe('rt95 channelCodec', () => {
  it('decodes synthetic fixture channel', () => {
    const image = buildSyntheticRt95Image();
    const ch = decodeChannelRecord(image.subarray(0, 32), 1, image);
    expect(ch.empty).toBe(false);
    expect(ch.wireName).toBe('TEST01');
    expect(ch.rxHz).toBe(146_520_000);
    expect(occupiedBitAt(image, 1)).toBe(true);
  });

  it('clears unused slots and occupancy bits on shrink encode', () => {
    const image = buildSyntheticRt95Image();
    const map = memoryMapFromBytes(image);

    encodeChannelsIntoImage(map, []);

    expect(map.bytes[0]).toBe(0xff);
    expect(occupiedBitAt(map.bytes, 1)).toBe(false);
    expect(map.bytes.subarray(0, RT95_CHANNEL_SPAN).every((b) => b === 0xff)).toBe(true);
  });

  it('maps forbidTransmit to tx_off', () => {
    const raw = encodeChannelRecord(sampleDto({ rxOnly: true }));
    expect((raw[10]! >> 7) & 1).toBe(1);
  });

  it('round-trips a channel through encode/decode', () => {
    const dto = sampleDto({
      txTone: { kind: 'ctcss', hz: 100.0 },
      rxTone: { kind: 'dcs', code: 23, polarity: 'I' },
      scanAdd: true,
    });
    const image = new Uint8Array(RT95_IMAGE_SIZE);
    image.fill(0xff);
    encodeChannelsIntoImage(image, [dto]);
    const decoded = decodeChannelsFromImage(image).find((c) => c.slotIndex === 1)!;
    expect(decoded.wireName).toBe('TEST01');
    expect(decoded.rxHz).toBe(146_520_000);
    expect(decoded.txTone).toEqual({ kind: 'ctcss', hz: 100.0 });
    expect(decoded.rxTone).toEqual({ kind: 'dcs', code: 23, polarity: 'I' });
    expect(decoded.scanAdd).toBe(true);
    expect(occupiedBitAt(image, 1)).toBe(true);
  });
});
