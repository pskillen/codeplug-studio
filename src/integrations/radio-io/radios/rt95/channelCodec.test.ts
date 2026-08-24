import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import {
  decodeChannelRecord,
  decodeChannelsFromImage,
  encodeChannelRecord,
  encodeChannelsIntoImage,
} from './channelCodec.ts';
import {
  occupiedBitAt,
  scanBitAt,
  buildSyntheticRt95Image,
} from './__fixtures__/syntheticImage.ts';
import { RT95_CHANNEL_SPAN, RT95_IMAGE_SIZE, RT95_SCAN_BITFIELD_OFFSET } from './constants.ts';

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

function offsetBcdHex(raw: Uint8Array): string {
  return [...raw.subarray(4, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('rt95 channelCodec golden bytes', () => {
  it('encodes High + none + FM as CHIRP bytes 9/10/11', () => {
    const raw = encodeChannelRecord(sampleDto());
    expect(raw[9]).toBe(0x08);
    expect(raw[10]).toBe(0x08);
    expect(raw[11]).toBe(0x00);
    expect(offsetBcdHex(raw)).toBe('00000000');
  });

  it('encodes High + plus + FM', () => {
    const raw = encodeChannelRecord(sampleDto({ txHz: 147_120_000 }));
    expect(raw[9]).toBe(0x09);
    expect(raw[10]).toBe(0x08);
    expect(raw[11]).toBe(0x00);
    expect(offsetBcdHex(raw)).toBe('00000600');
  });

  it('encodes High + tx_off + FM with tx_off on byte 10 bit 0', () => {
    const raw = encodeChannelRecord(sampleDto({ rxOnly: true }));
    expect(raw[9]).toBe(0x08);
    expect(raw[10]).toBe(0x09);
    expect(raw[11]).toBe(0x00);
    expect((raw[10]! & 1) === 1).toBe(true);
  });

  it('encodes CTCSS encode-only on byte 11 bit 0', () => {
    const raw = encodeChannelRecord(sampleDto({ txTone: { kind: 'ctcss', hz: 100.0 } }));
    expect(raw[11]).toBe(0x01);
  });

  it('encodes CTCSS TSQL on byte 11', () => {
    const raw = encodeChannelRecord(
      sampleDto({
        txTone: { kind: 'ctcss', hz: 100.0 },
        rxTone: { kind: 'ctcss', hz: 100.0 },
      }),
    );
    expect(raw[11]).toBe(0x05);
  });

  it('encodes DTCS encode+decode on byte 11', () => {
    const raw = encodeChannelRecord(
      sampleDto({
        txTone: { kind: 'dcs', code: 23, polarity: 'N' },
        rxTone: { kind: 'dcs', code: 23, polarity: 'N' },
      }),
    );
    expect(raw[11]).toBe(0x0a);
    expect(raw[16]).toBe(0x13);
    expect(raw[14]).toBe(0x13);
  });

  it('encodes DTCS invert on byte 17 bit 1', () => {
    const raw = encodeChannelRecord(
      sampleDto({ txTone: { kind: 'dcs', code: 23, polarity: 'I' } }),
    );
    expect(raw[17]).toBe(0x02);
  });
});

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

  it('stamps scan bitfield for slots 1, 200, and mid-byte edges', () => {
    const image = new Uint8Array(RT95_IMAGE_SIZE);
    image.fill(0xff);
    encodeChannelsIntoImage(image, [
      sampleDto({ slotIndex: 1, scanAdd: true }),
      sampleDto({ slotIndex: 8, wireName: 'MID008', scanAdd: true }),
      sampleDto({ slotIndex: 200, wireName: 'END200', scanAdd: true }),
      sampleDto({ slotIndex: 50, wireName: 'OFF50', scanAdd: false }),
    ]);

    expect(scanBitAt(image, 1)).toBe(true);
    expect(scanBitAt(image, 8)).toBe(true);
    expect(scanBitAt(image, 200)).toBe(true);
    expect(scanBitAt(image, 50)).toBe(false);
    expect(image[RT95_SCAN_BITFIELD_OFFSET]).toBe(0x81);
    expect(image[RT95_SCAN_BITFIELD_OFFSET + 24]).toBe(0x80);
  });

  it('clears scan bits for unused slots on shrink encode', () => {
    const image = buildSyntheticRt95Image();
    image[RT95_SCAN_BITFIELD_OFFSET] = 0xff;
    encodeChannelsIntoImage(image, []);
    expect(scanBitAt(image, 1)).toBe(false);
    expect(
      image
        .subarray(RT95_SCAN_BITFIELD_OFFSET, RT95_SCAN_BITFIELD_OFFSET + 32)
        .every((b) => b === 0),
    ).toBe(true);
  });

  it('round-trips DTCS invert polarity on encode/decode', () => {
    const dto = sampleDto({
      txTone: { kind: 'dcs', code: 23, polarity: 'I' },
      rxTone: { kind: 'dcs', code: 754, polarity: 'N' },
    });
    const raw = encodeChannelRecord(dto);
    expect((raw[17]! >> 1) & 1).toBe(1);
    expect((raw[15]! >> 1) & 1).toBe(0);

    const image = new Uint8Array(RT95_IMAGE_SIZE);
    image.fill(0xff);
    encodeChannelsIntoImage(image, [dto]);
    const decoded = decodeChannelsFromImage(image).find((c) => c.slotIndex === 1)!;
    expect(decoded.txTone).toEqual({ kind: 'dcs', code: 23, polarity: 'I' });
    expect(decoded.rxTone).toEqual({ kind: 'dcs', code: 754, polarity: 'N' });
  });

  it('space-pads wire names to six bytes', () => {
    const raw = encodeChannelRecord(sampleDto({ wireName: 'AB' }));
    expect([...raw.subarray(24, 30)]).toEqual([0x41, 0x42, 0x20, 0x20, 0x20, 0x20]);
  });
});
