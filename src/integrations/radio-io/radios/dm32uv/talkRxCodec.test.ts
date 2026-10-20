import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET, DM32_OFFSET } from './constants.ts';
import { encodeDm32TalkGroupBlock, encodeTalkGroupsIntoDm32Image } from './talkGroupCodec.ts';
import { encodeDm32RxGroup, encodeRxGroupsIntoDm32Image } from './rxGroupCodec.ts';

function blankBlock(metadata: number): Uint8Array {
  const b = new Uint8Array(DM32_BLOCK_SIZE);
  b.fill(0xff);
  b[DM32_METADATA_OFFSET] = metadata;
  return b;
}

describe('talkGroupCodec', () => {
  it('encodes a named talk group into 0x44 payload', () => {
    const block = encodeDm32TalkGroupBlock([
      { index: 1, wireName: 'TG9', digitalId: 9, callType: 0x04 },
    ]);
    expect(block[DM32_METADATA_OFFSET]).toBe(DM32_METADATA.TALK_GROUPS);
    expect(block[1]).toBe(0x00); // flag after header
    expect(String.fromCharCode(block[2]!)).toBe('T');
  });

  it('leaves the analogue contact page unchanged and updates talk-group cardinality', () => {
    // Stock and MM9PDY share encodeTalkGroupsIntoDm32Image; this is the only writer.
    const image = createMemoryMap(DM32_BLOCK_SIZE * 3);
    const analog = blankBlock(DM32_METADATA.ANALOG_CONTACTS);
    analog[DM32_OFFSET.ANALOG_CONTACT_COUNT] = 7;
    image.set(0, analog);
    image.set(DM32_BLOCK_SIZE, blankBlock(DM32_METADATA.TALK_GROUPS));
    image.set(DM32_BLOCK_SIZE * 2, blankBlock(DM32_METADATA.METADATA_0x0B));
    const before = image.bytes.slice(0, DM32_BLOCK_SIZE);
    encodeTalkGroupsIntoDm32Image(
      image,
      {
        addressBase: 0,
        discovered: [
          { address: 0, metadata: DM32_METADATA.ANALOG_CONTACTS },
          { address: DM32_BLOCK_SIZE, metadata: DM32_METADATA.TALK_GROUPS },
          { address: DM32_BLOCK_SIZE * 2, metadata: DM32_METADATA.METADATA_0x0B },
        ],
      },
      [{ index: 1, wireName: 'A', digitalId: 1, callType: 0x04 }],
    );
    expect(image.bytes.subarray(0, DM32_BLOCK_SIZE)).toEqual(before);
    expect(image.bytes[DM32_OFFSET.ANALOG_CONTACT_COUNT]).toBe(7);
    expect(image.bytes[DM32_BLOCK_SIZE + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.TALK_GROUPS);
    expect(image.bytes[DM32_BLOCK_SIZE * 2]).toBe(1);
    expect(image.bytes[DM32_BLOCK_SIZE * 2 + 1]).toBe(0);
  });

  it('leaves the analogue contact page unchanged when the talk-group list is empty', () => {
    const image = createMemoryMap(DM32_BLOCK_SIZE * 3);
    const analog = blankBlock(DM32_METADATA.ANALOG_CONTACTS);
    analog[DM32_OFFSET.ANALOG_CONTACT_COUNT] = 7;
    image.set(0, analog);
    image.set(DM32_BLOCK_SIZE, blankBlock(DM32_METADATA.TALK_GROUPS));
    image.set(DM32_BLOCK_SIZE * 2, blankBlock(DM32_METADATA.METADATA_0x0B));
    const before = image.bytes.slice(0, DM32_BLOCK_SIZE);
    encodeTalkGroupsIntoDm32Image(
      image,
      {
        addressBase: 0,
        discovered: [
          { address: 0, metadata: DM32_METADATA.ANALOG_CONTACTS },
          { address: DM32_BLOCK_SIZE, metadata: DM32_METADATA.TALK_GROUPS },
          { address: DM32_BLOCK_SIZE * 2, metadata: DM32_METADATA.METADATA_0x0B },
        ],
      },
      [],
    );
    expect(image.bytes.subarray(0, DM32_BLOCK_SIZE)).toEqual(before);
    expect(image.bytes[DM32_OFFSET.ANALOG_CONTACT_COUNT]).toBe(7);
  });

  it('replaces prior talk groups when list shrinks', () => {
    const image = createMemoryMap(DM32_BLOCK_SIZE * 3);
    image.set(0, blankBlock(DM32_METADATA.ANALOG_CONTACTS));
    image.set(DM32_BLOCK_SIZE, blankBlock(DM32_METADATA.TALK_GROUPS));
    image.set(DM32_BLOCK_SIZE * 2, blankBlock(DM32_METADATA.METADATA_0x0B));
    const ctx = {
      addressBase: 0,
      discovered: [
        { address: 0, metadata: DM32_METADATA.ANALOG_CONTACTS },
        { address: DM32_BLOCK_SIZE, metadata: DM32_METADATA.TALK_GROUPS },
        { address: DM32_BLOCK_SIZE * 2, metadata: DM32_METADATA.METADATA_0x0B },
      ],
    };
    encodeTalkGroupsIntoDm32Image(image, ctx, [
      { index: 1, wireName: 'First', digitalId: 1, callType: 0x04 },
      { index: 2, wireName: 'Second', digitalId: 2, callType: 0x04 },
    ]);
    expect(image.bytes[DM32_BLOCK_SIZE + 2]).toBe('F'.charCodeAt(0));

    encodeTalkGroupsIntoDm32Image(image, ctx, [
      { index: 1, wireName: 'Only', digitalId: 9, callType: 0x04 },
    ]);
    expect(image.bytes[DM32_BLOCK_SIZE + 2]).toBe('O'.charCodeAt(0));
    expect(image.bytes[DM32_BLOCK_SIZE + 30]).toBe(0x00);
  });
});

describe('rxGroupCodec', () => {
  it('encodes name and member DMR ids', () => {
    const rec = encodeDm32RxGroup({
      index: 1,
      wireName: 'Local',
      memberDigitalIds: [91, 92],
    });
    expect(rec[0]).toBe('L'.charCodeAt(0));
    expect(rec[0x0b] | (rec[0x0c]! << 8) | (rec[0x0d]! << 16)).toBe(91);
  });

  it('writes RX groups into 0x0F block', () => {
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.set(0, blankBlock(DM32_METADATA.RX_GROUPS));
    encodeRxGroupsIntoDm32Image(
      image,
      { addressBase: 0, discovered: [{ address: 0, metadata: DM32_METADATA.RX_GROUPS }] },
      [{ index: 1, wireName: 'G1', memberDigitalIds: [1] }],
    );
    expect(image.bytes[0] & 0x01).toBe(1);
    expect(image.bytes[DM32_METADATA_OFFSET]).toBe(DM32_METADATA.RX_GROUPS);
  });
});
