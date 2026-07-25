import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { UV21_PRO_V2_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  decodeChannelRecord,
  encodeChannelRecord,
  encodeChannelsIntoImage,
  readFirmwareFromImage,
  UV17PRO_SCAN_BIT,
} from '../uv17pro-family/channelCodec.ts';
import { createBlankSyntheticImage, createSyntheticImageBase } from './__fixtures__/syntheticImage.ts';

const L = UV21_PRO_V2_LAYOUT;

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

describe('UV-21Pro V2 channelCodec', () => {
  it('clears full 1000-slot span and preserves firmware overlay', () => {
    const image = createSyntheticImageBase();
    image[0] = 0xaa;
    image[L.channelSpan - 1] = 0xbb;
    encodeChannelsIntoImage(L, image, [sampleDto({ slotIndex: 5, wireName: 'FIVE' })]);
    expect(image[0]).toBe(0xff);
    expect(image[L.channelSpan - 1]).toBe(0xff);
    expect(readFirmwareFromImage(L, image)).toBe('UV21PROV2-TEST');
    const rec = image.subarray(4 * L.channelSize, 5 * L.channelSize);
    expect(decodeChannelRecord(L, rec, 5).wireName).toBe('FIVE');
  });

  it('encodes rxOnly and scanAdd bits', () => {
    const rec = encodeChannelRecord(
      L,
      sampleDto({ rxOnly: true, scanAdd: true, bandwidth: 'NFM' }),
    );
    expect(rec[4]).toBe(0xff);
    expect(rec[15]! & UV17PRO_SCAN_BIT).toBe(UV17PRO_SCAN_BIT);
  });

  it('supports slot index 1000', () => {
    const image = createBlankSyntheticImage();
    encodeChannelsIntoImage(L, image, [sampleDto({ slotIndex: 1000, wireName: 'LAST' })]);
    const offset = 999 * L.channelSize;
    expect(decodeChannelRecord(L, image.subarray(offset, offset + L.channelSize), 1000).wireName).toBe(
      'LAST',
    );
  });
});
