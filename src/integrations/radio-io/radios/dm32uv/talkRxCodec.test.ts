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

  it('patches counter and TG block on image', () => {
    const image = createMemoryMap(DM32_BLOCK_SIZE * 3);
    image.set(0, blankBlock(DM32_METADATA.CONFIG_TG_COUNTER));
    image.set(DM32_BLOCK_SIZE, blankBlock(DM32_METADATA.TALK_GROUPS));
    image.set(DM32_BLOCK_SIZE * 2, blankBlock(DM32_METADATA.METADATA_0x0B));
    encodeTalkGroupsIntoDm32Image(
      image,
      {
        addressBase: 0,
        discovered: [
          { address: 0, metadata: DM32_METADATA.CONFIG_TG_COUNTER },
          { address: DM32_BLOCK_SIZE, metadata: DM32_METADATA.TALK_GROUPS },
          { address: DM32_BLOCK_SIZE * 2, metadata: DM32_METADATA.METADATA_0x0B },
        ],
      },
      [{ index: 1, wireName: 'A', digitalId: 1, callType: 0x04 }],
    );
    expect(image.bytes[DM32_OFFSET.TALK_GROUP_COUNTER]).toBe(1);
    expect(image.bytes[DM32_BLOCK_SIZE + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.TALK_GROUPS);
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
