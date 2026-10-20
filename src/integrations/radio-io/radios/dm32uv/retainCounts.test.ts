/**
 * DM-32UV on-radio count readers.
 */

import { describe, expect, it } from 'vitest';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET, DM32_OFFSET } from './constants.ts';
import {
  aggregateOnRadioCounts,
  countTalkGroupsInBlocks,
  countZonesInBlock,
  type Dm32SparseBlockInput,
} from './retainCounts.ts';

function sparseBlock(metadata: number, patch?: (data: Uint8Array) => void): Dm32SparseBlockInput {
  const data = new Uint8Array(DM32_BLOCK_SIZE);
  data.fill(0xff);
  data[DM32_METADATA_OFFSET] = metadata;
  patch?.(data);
  return { address: 0, data, metadata, type: 'unknown' };
}

describe('countZonesInBlock', () => {
  it('counts the 0x5C header page from offset 16', () => {
    const header = sparseBlock(DM32_METADATA.ZONE, (data) => {
      data[0] = 'Z'.charCodeAt(0);
      data[16] = 'A'.charCodeAt(0);
    });
    expect(countZonesInBlock(header.data, header.metadata)).toBe(1);
  });

  it('counts a later zone page from offset 0', () => {
    const later = sparseBlock(0x5d, (data) => {
      data[0] = 'B'.charCodeAt(0);
    });
    later.type = 'zone';
    expect(countZonesInBlock(later.data, later.metadata)).toBe(1);
    expect(aggregateOnRadioCounts([later], 0, 0).zoneCount).toBe(1);
  });
});

describe('countTalkGroupsInBlocks', () => {
  it('ignores the analogue contact count when talk-group blocks are absent', () => {
    const analog = sparseBlock(DM32_METADATA.ANALOG_CONTACTS, (data) => {
      data[DM32_OFFSET.ANALOG_CONTACT_COUNT] = 7;
    });
    expect(countTalkGroupsInBlocks([analog])).toBe(0);
  });

  it('prefers the quick-access u16 over the analogue contact count', () => {
    const analog = sparseBlock(DM32_METADATA.ANALOG_CONTACTS, (data) => {
      data[DM32_OFFSET.ANALOG_CONTACT_COUNT] = 7;
    });
    const quick = sparseBlock(DM32_METADATA.METADATA_0x0B, (data) => {
      data[0] = 19;
      data[1] = 0;
    });
    expect(countTalkGroupsInBlocks([analog, quick])).toBe(19);
  });

  it('uses the quick-access count when the talk-group name walk is empty', () => {
    const talkGroups = sparseBlock(DM32_METADATA.TALK_GROUPS);
    const quick = sparseBlock(DM32_METADATA.METADATA_0x0B, (data) => {
      data[0] = 19;
      data[1] = 0;
    });
    expect(countTalkGroupsInBlocks([talkGroups, quick])).toBe(19);
  });

  it('walks a named talk-group entry when quick access is absent', () => {
    const talkGroups = sparseBlock(DM32_METADATA.TALK_GROUPS, (data) => {
      data[0] = 'T'.charCodeAt(0);
      data[20] = 0;
    });
    expect(countTalkGroupsInBlocks([talkGroups])).toBe(1);
  });
});
