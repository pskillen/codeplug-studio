import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  createBlankSyntheticImage,
  createSyntheticImageBase,
} from './__fixtures__/syntheticImage.ts';
import {
  decodeChannelRecord,
  decodeChannelsFromImage,
  encodeBcdFreq,
  encodeChannelRecord,
  encodeChannelsIntoImage,
  encodeTone,
  readFirmwareFromImage,
} from './channelCodec.ts';
import { UV5R_MINI_CHANNEL_SIZE } from './constants.ts';

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
    ...overrides,
  };
}

describe('channelCodec BCD / tone', () => {
  it('round-trips BCD frequency', () => {
    const encoded = encodeBcdFreq(145_500_000);
    expect(encoded.length).toBe(4);
    // decode via full record
    const rec = encodeChannelRecord(sampleDto({ rxHz: 433_000_000, txHz: 433_000_000 }));
    const decoded = decodeChannelRecord(rec, 1);
    expect(decoded.rxHz).toBe(433_000_000);
  });

  it('encodes CTCSS tone', () => {
    const bytes = encodeTone({ kind: 'ctcss', hz: 88.5 });
    expect(bytes[0]! | (bytes[1]! << 8)).toBe(885);
  });
});

describe('channelCodec record', () => {
  it('encodes empty as 0xFF fill', () => {
    const rec = encodeChannelRecord(sampleDto({ empty: true, rxHz: 0 }));
    expect(rec.every((b) => b === 0xff)).toBe(true);
    expect(decodeChannelRecord(rec, 3).empty).toBe(true);
  });

  it('round-trips name, power Low, NFM', () => {
    const dto = sampleDto({
      wireName: 'GB3XX',
      powerPercent: 20,
      bandwidth: 'NFM',
      rxTone: { kind: 'ctcss', hz: 77.0 },
    });
    const decoded = decodeChannelRecord(encodeChannelRecord(dto), 1);
    expect(decoded.wireName).toBe('GB3XX');
    expect(decoded.powerPercent).toBe(20);
    expect(decoded.bandwidth).toBe('NFM');
    expect(decoded.rxTone).toEqual({ kind: 'ctcss', hz: 77 });
  });

  it('writes into image without clobbering firmware region', () => {
    const image = createSyntheticImageBase();
    const settingsMarker = 0xaa;
    image[0x8040] = settingsMarker;
    encodeChannelsIntoImage(image, [sampleDto({ slotIndex: 1, wireName: 'A1' })]);
    expect(image[0x8040]).toBe(settingsMarker);
    const channels = decodeChannelsFromImage(image);
    expect(channels[0]?.wireName).toBe('A1');
    expect(channels[0]?.empty).toBe(false);
    expect(readFirmwareFromImage(image)).toBe('UV5RMINI-TEST');
  });

  it('reads empty slots from blank image', () => {
    const image = createBlankSyntheticImage();
    const channels = decodeChannelsFromImage(image);
    expect(channels).toHaveLength(999);
    expect(channels.every((c) => c.empty)).toBe(true);
  });

  it('record size is 32 bytes', () => {
    expect(encodeChannelRecord(sampleDto()).length).toBe(UV5R_MINI_CHANNEL_SIZE);
  });
});
