/**
 * Scripted BytePipe helpers + synthetic sparse blocks for DM-32UV unit tests.
 */

import type { BytePipe } from '../../types.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from '../constants.ts';

export class Dm32ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private queue: Uint8Array[] = [];

  enqueue(...chunks: Uint8Array[]): void {
    this.queue.push(...chunks);
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    void timeoutMs;
    if (this.queue.length === 0) {
      throw new Error(`Dm32ScriptedPipe: no queued bytes for readExact(${n})`);
    }
    const next = this.queue.shift()!;
    if (next.length !== n) {
      throw new Error(`Dm32ScriptedPipe: expected ${n} bytes, queued ${next.length}`);
    }
    return next;
  }

  async close(): Promise<void> {
    /* no-op */
  }
}

function u32le(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

export function makeEmptyBlock(metadata: number): Uint8Array {
  const block = new Uint8Array(DM32_BLOCK_SIZE);
  block.fill(0xff);
  block[DM32_METADATA_OFFSET] = metadata;
  return block;
}

/** First channel block: count + one occupied-looking slot header area. */
export function makeFirstChannelBlock(channelCount: number): Uint8Array {
  const block = makeEmptyBlock(DM32_METADATA.CHANNEL_FIRST);
  block[0] = channelCount & 0xff;
  block[1] = (channelCount >>> 8) & 0xff;
  return block;
}

export function enqueueVFrame(pipe: Dm32ScriptedPipe, id: number, payload: Uint8Array): void {
  pipe.enqueue(new Uint8Array([0x56, id, payload.length]));
  if (payload.length > 0) pipe.enqueue(payload);
}

export function enqueueReadReply(pipe: Dm32ScriptedPipe, address: number, data: Uint8Array): void {
  const header = new Uint8Array([
    0x57,
    address & 0xff,
    (address >>> 8) & 0xff,
    (address >>> 16) & 0xff,
    data.length & 0xff,
    (data.length >>> 8) & 0xff,
  ]);
  pipe.enqueue(header);
  pipe.enqueue(data);
}

/**
 * Script connect + download for a tiny 2-block config range:
 * start=0x1000, end=0x1fff → one block at 0x1000 (channel first).
 * Also plant required fixed metadata by using a second block at 0x2000 as settings.
 *
 * Range end 0x2fff → blocks 0x1000 and 0x2000.
 */
export function scriptDm32DownloadTwoBlocks(pipe: Dm32ScriptedPipe, channelCount = 1): {
  start: number;
  end: number;
  channelBlock: Uint8Array;
  settingsBlock: Uint8Array;
} {
  const start = 0x1000;
  const end = 0x2fff;
  const channelBlock = makeFirstChannelBlock(channelCount);
  const settingsBlock = makeEmptyBlock(DM32_METADATA.VFO_SETTINGS);

  // Handshake
  const psearch = new Uint8Array(8);
  psearch[0] = 0x06;
  psearch.set(new TextEncoder().encode('DP570UV'), 1);
  pipe.enqueue(psearch);
  pipe.enqueue(new Uint8Array([0x50, 0x00, 0x00]));
  pipe.enqueue(new Uint8Array([0x06]));

  // V-frames — only 0x0A required; others may fail; enqueue success for all queried ids
  const layout = new Uint8Array(8);
  layout.set(u32le(start), 0);
  layout.set(u32le(end), 4);
  const firmware = new TextEncoder().encode('DM32.TEST.001\0');
  for (const id of [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0d, 0x0e, 0x0f, 0x10]) {
    if (id === 0x0a) enqueueVFrame(pipe, id, layout);
    else if (id === 0x01) enqueueVFrame(pipe, id, firmware);
    else enqueueVFrame(pipe, id, new Uint8Array(0));
  }

  // PROGRAM
  pipe.enqueue(new Uint8Array([0x06]));
  pipe.enqueue(new Uint8Array(8).fill(0xff));
  pipe.enqueue(new Uint8Array([0x06]));

  // Discovery: metadata at 0x1000+0xFFF and 0x2000+0xFFF
  enqueueReadReply(pipe, start + DM32_METADATA_OFFSET, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
  enqueueReadReply(pipe, 0x2000 + DM32_METADATA_OFFSET, new Uint8Array([DM32_METADATA.VFO_SETTINGS]));

  // Channel count (2 bytes at first block)
  enqueueReadReply(pipe, start, new Uint8Array([channelCount & 0xff, (channelCount >>> 8) & 0xff]));

  // Bulk read full blocks (channel + settings)
  enqueueReadReply(pipe, start, channelBlock);
  enqueueReadReply(pipe, 0x2000, settingsBlock);

  return { start, end, channelBlock, settingsBlock };
}
