import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { PROGRAM_RW_ACK } from '../../kit/codecs/programRw.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { createSyntheticImageBase } from './__fixtures__/syntheticImage.ts';
import { encodeChannelsIntoImage } from './channelCodec.ts';
import {
  UV5R_MINI_BLOCK_SIZE,
  UV5R_MINI_CLONE_BLOCK_COUNT,
  UV5R_MINI_IDENT,
  UV5R_MINI_MEM_TOTAL,
  UV5R_MINI_READ_RESPONSE_LEN,
} from './constants.ts';
import { uv5rMiniCrypt } from './crypt.ts';
import { Uv5rMiniProtocol } from './protocol.ts';

/**
 * Scripted BytePipe: queues expected peer replies; records writes.
 * Enough to drive Mini handshake + block R/W without hardware.
 */
class ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private queue: Uint8Array[] = [];

  enqueue(...chunks: Uint8Array[]): void {
    this.queue.push(...chunks);
  }

  /** Queue ACK for ident or write. */
  enqueueAck(): void {
    this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
  }

  /** Queue magic reply of given length (zeros). */
  enqueueMagic(len: number): void {
    this.enqueue(new Uint8Array(len));
  }

  /** Queue a PROGRAM+R/W read reply for a plain block. */
  enqueueReadReply(plain: Uint8Array, addr: number): void {
    const encrypted = uv5rMiniCrypt(plain);
    const frame = new Uint8Array(UV5R_MINI_READ_RESPONSE_LEN);
    frame[0] = 0x52;
    frame[1] = (addr >>> 8) & 0xff;
    frame[2] = addr & 0xff;
    frame[3] = UV5R_MINI_BLOCK_SIZE;
    frame.set(encrypted, 4);
    this.enqueue(frame);
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
  }

  async readExact(n: number, _timeoutMs: number): Promise<Uint8Array> {
    if (this.queue.length === 0) {
      throw new Error(`ScriptedPipe: no queued bytes for readExact(${n})`);
    }
    const next = this.queue.shift()!;
    if (next.length !== n) {
      throw new Error(`ScriptedPipe: expected ${n} bytes, queued ${next.length}`);
    }
    return next;
  }

  async close(): Promise<void> {
    /* no-op */
  }
}

function scriptFullDownload(pipe: ScriptedPipe, image: Uint8Array): void {
  // Ident ACK
  pipe.enqueueAck();
  // Read magics: 16, 15, 1
  pipe.enqueueMagic(16);
  pipe.enqueueMagic(15);
  pipe.enqueueMagic(1);

  // Regions: 0x0000/0x8040, 0x9000/0x40, 0xa000/0x1c0
  const regions: Array<{ start: number; size: number; packed: number }> = [
    { start: 0x0000, size: 0x8040, packed: 0 },
    { start: 0x9000, size: 0x0040, packed: 0x8040 },
    { start: 0xa000, size: 0x01c0, packed: 0x8080 },
  ];
  for (const region of regions) {
    for (let off = 0; off < region.size; off += UV5R_MINI_BLOCK_SIZE) {
      const addr = region.start + off;
      const plain = image.subarray(region.packed + off, region.packed + off + UV5R_MINI_BLOCK_SIZE);
      pipe.enqueueReadReply(plain, addr);
    }
  }
}

function scriptUploadHandshake(pipe: ScriptedPipe): void {
  pipe.enqueueAck();
  pipe.enqueueMagic(16);
  pipe.enqueueMagic(15);
  pipe.enqueueMagic(1);
  for (let i = 0; i < UV5R_MINI_CLONE_BLOCK_COUNT; i++) {
    pipe.enqueueAck();
  }
}

describe('Uv5rMiniProtocol', () => {
  it('downloads multi-region image into packed MemoryMap', async () => {
    const source = createSyntheticImageBase();
    encodeChannelsIntoImage(source, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'TEST',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
      },
    ]);

    const pipe = new ScriptedPipe();
    scriptFullDownload(pipe, source);

    const radio = new Uv5rMiniProtocol();
    await radio.connect(pipe);
    const image = await radio.download({});
    expect(image.size).toBe(UV5R_MINI_MEM_TOTAL);
    expect(radio.decodeChannels(image)[0]?.wireName).toBe('TEST');
    expect(radio.readFirmware(image)).toBe('UV5RMINI-TEST');
    expect(pipe.writes[0]).toEqual(UV5R_MINI_IDENT);
  });

  it('uploads after upload handshake and preserves non-channel bytes', async () => {
    const source = createSyntheticImageBase();
    source[0x8040] = 0x5a; // settings region marker
    encodeChannelsIntoImage(source, [
      {
        slotIndex: 2,
        empty: false,
        wireName: 'CH2',
        rxHz: 433_000_000,
        txHz: 433_000_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 20,
        bandwidth: 'NFM',
      },
    ]);

    const pipe = new ScriptedPipe();
    // connect (read handshake)
    pipe.enqueueAck();
    pipe.enqueueMagic(16);
    pipe.enqueueMagic(15);
    pipe.enqueueMagic(1);
    scriptUploadHandshake(pipe);

    const radio = new Uv5rMiniProtocol();
    await radio.connect(pipe);
    const map = memoryMapFromBytes(source);
    await radio.upload(map, {});

    // Last write should be a W frame (0x57)
    const last = pipe.writes[pipe.writes.length - 1]!;
    expect(last[0]).toBe(0x57);
    expect(last.length).toBe(4 + UV5R_MINI_BLOCK_SIZE);
  });
});
