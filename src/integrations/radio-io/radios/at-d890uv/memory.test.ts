import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { AT_D890_LIMITS, AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import {
  alignedSpanForAtD890Region,
  applyAtD890WriteImageToCache,
  clearTalkgroupDataBlocksFromCache,
  getCacheBytes,
  putCacheBytes,
  talkgroupAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { encodeTalkgroupsIntoAtD890Image } from './talkGroupCodec.ts';

describe('alignedSpanForAtD890Region', () => {
  it('covers odd talkgroup slots that are not 16-aligned', () => {
    const slot1 = talkgroupAddress(1);
    expect(slot1).toBe(D890_MAP.TalkgroupData + 0xc8);
    expect(slot1 % 16).toBe(8);
    const span = alignedSpanForAtD890Region(slot1, AT_D890_LIMITS.TALKGROUP_RECORD_SIZE);
    expect(span.start).toBe(D890_MAP.TalkgroupData + 0xc0);
    expect(span.start % 16).toBe(0);
    expect(span.length % 16).toBe(0);
    expect(span.start + span.length).toBeGreaterThanOrEqual(
      slot1 + AT_D890_LIMITS.TALKGROUP_RECORD_SIZE,
    );
  });
});

describe('talkgroup cache merge', () => {
  it('writes odd-index talkgroups without unaligned putCacheBytes', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(0, AT_D890_MAP_SIZE, 0xff);
    encodeTalkgroupsIntoAtD890Image(image, [
      { index: 1, wireName: 'A', digitalId: 1, callType: 0x04 },
      { index: 2, wireName: 'B', digitalId: 2, callType: 0x04 },
    ]);

    const cache: AtD890DownloadCache = {
      blocks: new Map([
        // Stale block from pre-fix 0xd0 stride Read
        [D890_MAP.TalkgroupData + 0xd0, new Uint8Array(16).fill(0xaa)],
      ]),
    };
    applyAtD890WriteImageToCache(cache, image);

    // 0xd0 is a valid 16-byte key inside slot 1's aligned span; stale 0xaa must be gone.
    expect(cache.blocks.get(D890_MAP.TalkgroupData + 0xd0)![0]).not.toBe(0xaa);
    expect(cache.blocks.has(D890_MAP.TalkgroupData + 0xc0)).toBe(true);
    const slot1 = getCacheBytes(cache, talkgroupAddress(1), 1);
    expect(slot1[0]).toBe(0x01);
  });

  it('clearTalkgroupDataBlocksFromCache removes bank keys only', () => {
    const cache: AtD890DownloadCache = {
      blocks: new Map([
        [D890_MAP.TalkgroupData, new Uint8Array(16)],
        [D890_MAP.TalkgroupData + 0xd0, new Uint8Array(16)],
        [D890_MAP.LocalInfo, new Uint8Array(16)],
      ]),
    };
    clearTalkgroupDataBlocksFromCache(cache);
    expect(cache.blocks.has(D890_MAP.TalkgroupData)).toBe(false);
    expect(cache.blocks.has(D890_MAP.TalkgroupData + 0xd0)).toBe(false);
    expect(cache.blocks.has(D890_MAP.LocalInfo)).toBe(true);
  });
});

describe('putCacheBytes', () => {
  it('splits long blobs into 16-byte keys', () => {
    const cache: AtD890DownloadCache = { blocks: new Map() };
    const data = new Uint8Array(0x30);
    data[0] = 1;
    data[0x10] = 2;
    data[0x20] = 3;
    putCacheBytes(cache, 0x1000, data);
    expect(cache.blocks.get(0x1000)![0]).toBe(1);
    expect(cache.blocks.get(0x1010)![0]).toBe(2);
    expect(cache.blocks.get(0x1020)![0]).toBe(3);
  });
});

describe('getCacheBytes unaligned', () => {
  it('assembles across 16-byte keys for a mid-block start', () => {
    const cache: AtD890DownloadCache = { blocks: new Map() };
    const block = new Uint8Array(16);
    block[8] = 0x01;
    putCacheBytes(cache, D890_MAP.TalkgroupData + 0xc0, block);
    expect(getCacheBytes(cache, talkgroupAddress(1), 1)[0]).toBe(0x01);
  });
});
