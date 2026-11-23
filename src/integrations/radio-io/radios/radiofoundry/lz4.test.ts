import { describe, expect, it } from 'vitest';
import { BLOCK_SIZE } from './constants.ts';
import { decodeBlock, encodeBlock } from './lz4.ts';

describe('RadioFoundry LZ4 blocks', () => {
  it('round-trips a 4096-byte codeplug block', () => {
    const block = new Uint8Array(BLOCK_SIZE);
    for (let i = 0; i < block.length; i += 1) {
      block[i] = i % 17 === 0 ? 0xff : (i * 3 + (i % 56)) & 0xff;
    }
    const stream = encodeBlock(block);
    expect(stream.length).toBeGreaterThan(0);
    expect(stream.length).toBeLessThan(4128);
    expect(decodeBlock(stream, BLOCK_SIZE)).toEqual(block);
  });

  it('round-trips a blank block and a run of one byte', () => {
    const blank = new Uint8Array(BLOCK_SIZE);
    blank.fill(0xff);
    expect(decodeBlock(encodeBlock(blank), BLOCK_SIZE)).toEqual(blank);
    const run = new Uint8Array(BLOCK_SIZE);
    run.fill(0x5a);
    expect(decodeBlock(encodeBlock(run), BLOCK_SIZE)).toEqual(run);
  });
});
