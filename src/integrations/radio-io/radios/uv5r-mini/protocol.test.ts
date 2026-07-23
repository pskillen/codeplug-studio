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
import { UV5R_MINI_MAGICS_READ, UV5R_MINI_MAGICS_UPLOAD } from './magics.ts';
import { Uv5rMiniProtocol } from './protocol.ts';

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Scripted BytePipe: queues peer replies when the protocol writes (post-flush).
 * readExact slices from an internal buffer so 1-byte ACK seek works.
 */
class ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private readBuf = new Uint8Array(0);
  private readBlockQueue: Array<{ addr: number; plain: Uint8Array }> = [];

  armReadBlocks(blocks: Array<{ addr: number; plain: Uint8Array }>): void {
    this.readBlockQueue = [...blocks];
  }

  private enqueue(...chunks: Uint8Array[]): void {
    for (const chunk of chunks) {
      const next = new Uint8Array(this.readBuf.length + chunk.length);
      next.set(this.readBuf);
      next.set(chunk, this.readBuf.length);
      this.readBuf = next;
    }
  }

  private enqueueAck(): void {
    this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
  }

  private enqueueMagic(len: number): void {
    this.enqueue(new Uint8Array(len));
  }

  private enqueueReadReply(plain: Uint8Array, addr: number, leadingJunk = false): void {
    if (leadingJunk) {
      this.enqueue(new Uint8Array([0x00, 0x00]));
    }
    const encrypted = uv5rMiniCrypt(plain);
    const frame = new Uint8Array(UV5R_MINI_READ_RESPONSE_LEN);
    frame[0] = 0x52;
    frame[1] = (addr >>> 8) & 0xff;
    frame[2] = addr & 0xff;
    frame[3] = UV5R_MINI_BLOCK_SIZE;
    frame.set(encrypted, 4);
    this.enqueue(frame);
  }

  private enqueueReadHandshake(junkBeforeAck = false): void {
    if (junkBeforeAck) {
      this.enqueue(new Uint8Array([0xff, 0xaa]));
    }
    this.enqueueAck();
  }

  private respondToMagic(data: Uint8Array): boolean {
    for (const magic of [...UV5R_MINI_MAGICS_READ, ...UV5R_MINI_MAGICS_UPLOAD]) {
      if (bytesEqual(data, magic.send)) {
        this.enqueueMagic(magic.responseLen);
        return true;
      }
    }
    return false;
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    if (bytesEqual(data, UV5R_MINI_IDENT)) {
      const handshakeCount = this.writes.filter((w) => bytesEqual(w, UV5R_MINI_IDENT)).length;
      this.enqueueReadHandshake(handshakeCount === 1);
      return;
    }
    if (this.respondToMagic(data)) {
      return;
    }
    if (data[0] === 0x52 && this.readBlockQueue.length > 0) {
      const addr = (data[1]! << 8) | data[2]!;
      const idx = this.readBlockQueue.findIndex((b) => b.addr === addr);
      const block = idx >= 0 ? this.readBlockQueue.splice(idx, 1)[0]! : this.readBlockQueue.shift()!;
      this.enqueueReadReply(block.plain, block.addr, addr === 0 && this.writes.length < 20);
    }
    if (data[0] === 0x57) {
      this.enqueueAck();
    }
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    void timeoutMs;
    if (this.readBuf.length < n) {
      throw new Error(`ScriptedPipe: needed ${n} bytes, have ${this.readBuf.length}`);
    }
    const result = this.readBuf.slice(0, n);
    this.readBuf = this.readBuf.length > n ? this.readBuf.slice(n) : new Uint8Array(0);
    return result;
  }

  async flush(): Promise<void> {
    this.readBuf = new Uint8Array(0);
  }

  async close(): Promise<void> {
    /* no-op */
  }
}

function listDownloadBlocks(image: Uint8Array): Array<{ addr: number; plain: Uint8Array }> {
  const blocks: Array<{ addr: number; plain: Uint8Array }> = [];
  const regions: Array<{ start: number; size: number; packed: number }> = [
    { start: 0x0000, size: 0x8040, packed: 0 },
    { start: 0x9000, size: 0x0040, packed: 0x8040 },
    { start: 0xa000, size: 0x01c0, packed: 0x8080 },
  ];
  for (const region of regions) {
    for (let off = 0; off < region.size; off += UV5R_MINI_BLOCK_SIZE) {
      const addr = region.start + off;
      const plain = image.subarray(region.packed + off, region.packed + off + UV5R_MINI_BLOCK_SIZE);
      blocks.push({ addr, plain });
    }
  }
  return blocks;
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
    pipe.armReadBlocks(listDownloadBlocks(source));

    const radio = new Uv5rMiniProtocol();
    await radio.connect(pipe, { settleScale: 0 });
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
    pipe.armReadBlocks([]);

    const radio = new Uv5rMiniProtocol();
    await radio.connect(pipe, { settleScale: 0 });
    const map = memoryMapFromBytes(source);
    await radio.upload(map, {});

    const last = pipe.writes[pipe.writes.length - 1]!;
    expect(last[0]).toBe(0x57);
    expect(last.length).toBe(4 + UV5R_MINI_BLOCK_SIZE);
    expect(pipe.writes.filter((w) => w[0] === 0x57)).toHaveLength(UV5R_MINI_CLONE_BLOCK_COUNT);
  });
});
