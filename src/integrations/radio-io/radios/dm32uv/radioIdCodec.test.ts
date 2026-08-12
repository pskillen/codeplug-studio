import { describe, expect, it } from 'vitest';
import {
  DM32_DMR_RADIO_ID_ENTRY_SIZE,
  encodeDm32RadioIdBlock,
  encodeDm32RadioIdEntry,
  encodeRadioIdsIntoDm32Image,
} from './radioIdCodec.ts';
import { mapDirectoryEntryToRadioRadioIdDto } from '@integrations/radioid/mapDirectoryEntryToRadioDto.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';

describe('encodeDm32RadioIdEntry', () => {
  it('encodes 3-byte LE ID and null-terminated name', () => {
    const entry = encodeDm32RadioIdEntry(12_345_678, 'MM9PDY');
    expect(entry).toHaveLength(DM32_DMR_RADIO_ID_ENTRY_SIZE);
    expect(entry[0]).toBe(0x4e);
    expect(entry[1]).toBe(0x61);
    expect(entry[2]).toBe(0xbc);
    expect(entry[3]).toBe('M'.charCodeAt(0));
    expect(entry[8]).toBe('Y'.charCodeAt(0));
    expect(entry[9]).toBe(0x00);
  });
});

describe('encodeDm32RadioIdBlock', () => {
  it('writes count and entries from offset 0x10', () => {
    const block = encodeDm32RadioIdBlock([
      { index: 0, dmrId: 123, name: 'Op1' },
      { index: 1, dmrId: 256, name: 'Op2' },
    ]);
    expect(block).toHaveLength(DM32_BLOCK_SIZE);
    expect(block[0]).toBe(2);
    expect(block[DM32_METADATA_OFFSET]).toBe(DM32_METADATA.DMR_RADIO_IDS);
    const first = block.subarray(0x10, 0x10 + DM32_DMR_RADIO_ID_ENTRY_SIZE);
    expect(first[0]).toBe(123);
    expect(first[1]).toBe(0);
    expect(first[2]).toBe(0);
    const second = block.subarray(0x20, 0x20 + DM32_DMR_RADIO_ID_ENTRY_SIZE);
    expect(second[0]).toBe(0);
    expect(second[1]).toBe(1);
    expect(second[2]).toBe(0);
  });

  it('encodes directory-sourced radio ID DTOs', () => {
    const dto = mapDirectoryEntryToRadioRadioIdDto(
      {
        projectId: 'p1',
        digitalId: 12_345_678,
        mode: 'dmr',
        name: 'Alice Example',
        callsign: 'AL1CE',
        city: '',
        state: '',
        country: '',
      },
      0,
    );
    const block = encodeDm32RadioIdBlock([dto]);
    expect(block[0]).toBe(1);
    expect(block.subarray(0x10, 0x10 + 3)).toEqual(
      encodeDm32RadioIdEntry(dto.dmrId, dto.name).subarray(0, 3),
    );
  });
});

describe('encodeRadioIdsIntoDm32Image', () => {
  it('patches discovered 0x67 block in the memory map', () => {
    const addressBase = 0x1000;
    const radioIdAddress = 0x5000;
    const mapSize = radioIdAddress - addressBase + DM32_BLOCK_SIZE;
    const image = createMemoryMap(mapSize);
    image.fill(0xff, 0, mapSize);
    const ctx = {
      addressBase,
      discovered: [{ address: radioIdAddress, metadata: DM32_METADATA.DMR_RADIO_IDS }],
    };
    encodeRadioIdsIntoDm32Image(image, ctx, [{ index: 0, dmrId: 123, name: 'Me' }]);
    const offset = radioIdAddress - addressBase;
    expect(image.bytes[offset]).toBe(1);
    expect(image.bytes[offset + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.DMR_RADIO_IDS);
    expect(image.bytes[offset + 0x10]).toBe(123);
  });
});
