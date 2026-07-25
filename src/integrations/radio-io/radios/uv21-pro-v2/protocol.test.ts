import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { PROGRAM_RW_ACK } from '../../kit/codecs/programRw.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { UV21_PRO_V2_LAYOUT } from '../uv17pro-family/layout.ts';
import { encodeChannelsIntoImage } from '../uv17pro-family/channelCodec.ts';
import { uv17ProCrypt } from '../uv17pro-family/crypt.ts';
import { createUv17ProProtocol } from '../uv17pro-family/protocol.ts';
import { createSyntheticImageBase } from './__fixtures__/syntheticImage.ts';

const L = UV21_PRO_V2_LAYOUT;
const READ_RESPONSE_LEN = 4 + L.blockSize;

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

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
    const encrypted = uv17ProCrypt(plain);
    const frame = new Uint8Array(READ_RESPONSE_LEN);
    frame[0] = 0x52;
    frame[1] = (addr >>> 8) & 0xff;
    frame[2] = addr & 0xff;
    frame[3] = L.blockSize;
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
    for (const magic of [...L.magics.read, ...L.magics.upload]) {
      if (bytesEqual(data, magic.send)) {
        this.enqueueMagic(magic.responseLen);
        return true;
      }
    }
    return false;
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    if (bytesEqual(data, L.ident)) {
      const handshakeCount = this.writes.filter((w) => bytesEqual(w, L.ident)).length;
      this.enqueueReadHandshake(handshakeCount === 1);
      return;
    }
    if (this.respondToMagic(data)) {
      return;
    }
    if (data[0] === 0x52 && this.readBlockQueue.length > 0) {
      const addr = (data[1]! << 8) | data[2]!;
      const idx = this.readBlockQueue.findIndex((b) => b.addr === addr);
      const block =
        idx >= 0 ? this.readBlockQueue.splice(idx, 1)[0]! : this.readBlockQueue.shift()!;
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
  let packed = 0;
  for (let i = 0; i < L.memStarts.length; i++) {
    const start = L.memStarts[i]!;
    const size = L.memSizes[i]!;
    for (let off = 0; off < size; off += L.blockSize) {
      blocks.push({
        addr: start + off,
        plain: image.subarray(packed + off, packed + off + L.blockSize),
      });
    }
    packed += size;
  }
  return blocks;
}

describe('Uv21ProV2Protocol', () => {
  it('downloads four-region image into packed MemoryMap', async () => {
    const source = createSyntheticImageBase();
    encodeChannelsIntoImage(L, source, [
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

    const radio = createUv17ProProtocol(L);
    await radio.connect(pipe, { settleScale: 0 });
    const image = await radio.download({});
    expect(image.size).toBe(L.memTotal);
    expect(radio.decodeChannels(image)[0]?.wireName).toBe('TEST');
    expect(radio.readFirmware(image)).toBe('UV21PROV2-TEST');
    expect(pipe.writes[0]).toEqual(L.ident);
  });

  it('uploads after upload handshake across four MEM regions', async () => {
    const source = createSyntheticImageBase();
    source[L.settingsOffset] = 0x5a;
    encodeChannelsIntoImage(L, source, [
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

    const radio = createUv17ProProtocol(L);
    await radio.connect(pipe, { handshake: 'none' });
    await radio.upload(memoryMapFromBytes(source), {});

    expect(pipe.writes.filter((w) => w[0] === 0x57)).toHaveLength(L.cloneBlockCount);
  });
});
