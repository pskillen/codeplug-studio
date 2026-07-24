import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import {
  OPENGD77_BLOCK,
  OPENGD77_CMD_OK,
  OPENGD77_SECTOR,
  OPENGD77_TYPE_COMMAND,
  OPENGD77_TYPE_READ,
  OPENGD77_TYPE_WRITE_UV380,
  OPENGD77_WRITE_CMD_FINISH_SECTOR,
  OPENGD77_WRITE_CMD_SECTOR_BUFFER,
  OPENGD77_WRITE_CMD_SET_SECTOR,
} from '../../kit/codecs/opengd77Serial.ts';
import { encodeChannelsIntoImage } from './channelCodec.ts';
import { OPENUV380_FLASH_SPANS, OPENUV380_OFFSET } from './constants.ts';
import { createOpenUv380Image, readAbs } from './memory.ts';
import {
  OPENGD77_FIRMWARE_INFO_SIZE,
  OpenGd77Protocol,
  parseFirmwareInfo,
} from './protocol.ts';

function putU32Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
  buf[offset + 3] = (value >> 24) & 0xff;
}

function makeFirmwareInfoPayload(radioType = 0x08): Uint8Array {
  const payload = new Uint8Array(OPENGD77_FIRMWARE_INFO_SIZE);
  putU32Le(payload, 0, 3);
  putU32Le(payload, 4, radioType);
  const rev = new TextEncoder().encode('R20240101000000');
  payload.set(rev.subarray(0, 16), 8);
  const date = new TextEncoder().encode('20240101120000');
  payload.set(date.subarray(0, 16), 24);
  return payload;
}

function enqueue(buf: Uint8Array, chunks: Uint8Array[]): Uint8Array {
  let next = buf;
  for (const chunk of chunks) {
    const merged = new Uint8Array(next.length + chunk.length);
    merged.set(next);
    merged.set(chunk, next.length);
    next = merged;
  }
  return next;
}

/** Scripted OpenGD77 BytePipe for connect / download / upload. */
class OpenGd77ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private readBuf = new Uint8Array(0);
  private flash = new Map<number, number>();

  constructor(private readonly radioType = 0x08) {
    // Pre-fill registered spans with 0xff
    for (const span of OPENUV380_FLASH_SPANS) {
      for (let i = 0; i < span.length; i++) {
        this.flash.set(span.start + i, 0xff);
      }
    }
  }

  /** Plant a known channel bank0 byte for download verify. */
  plantByte(abs: number, value: number): void {
    this.flash.set(abs, value & 0xff);
  }

  private enqueue(...chunks: Uint8Array[]): void {
    this.readBuf = enqueue(this.readBuf, chunks);
  }

  private enqueueCmdAck(): void {
    this.enqueue(new Uint8Array([OPENGD77_CMD_OK]));
  }

  private enqueueWriteAck(cmd: number): void {
    this.enqueue(new Uint8Array([OPENGD77_TYPE_WRITE_UV380, cmd]));
  }

  private enqueueReadReply(payload: Uint8Array): void {
    const frame = new Uint8Array(3 + payload.length);
    frame[0] = OPENGD77_TYPE_READ;
    frame[1] = (payload.length >> 8) & 0xff;
    frame[2] = payload.length & 0xff;
    frame.set(payload, 3);
    this.enqueue(frame);
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    if (data[0] === OPENGD77_TYPE_COMMAND) {
      this.enqueueCmdAck();
      return;
    }
    if (data[0] === OPENGD77_TYPE_READ) {
      const mem = data[1]!;
      const addr =
        ((data[2]! << 24) | (data[3]! << 16) | (data[4]! << 8) | data[5]!) >>> 0;
      const length = ((data[6]! << 8) | data[7]!) >>> 0;
      if (mem === 0x09) {
        this.enqueueReadReply(makeFirmwareInfoPayload(this.radioType));
        return;
      }
      if (mem === 0x01) {
        const payload = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
          payload[i] = this.flash.get(addr + i) ?? 0xff;
        }
        this.enqueueReadReply(payload);
        return;
      }
      throw new Error(`Unexpected mem code 0x${mem.toString(16)}`);
    }
    if (data[0] === OPENGD77_TYPE_WRITE_UV380) {
      const cmd = data[1]!;
      if (cmd === OPENGD77_WRITE_CMD_SET_SECTOR) {
        this.enqueueWriteAck(cmd);
        return;
      }
      if (cmd === OPENGD77_WRITE_CMD_SECTOR_BUFFER) {
        const addr =
          ((data[2]! << 24) | (data[3]! << 16) | (data[4]! << 8) | data[5]!) >>> 0;
        const length = ((data[6]! << 8) | data[7]!) >>> 0;
        for (let i = 0; i < length; i++) {
          this.flash.set(addr + i, data[8 + i]!);
        }
        this.enqueueWriteAck(cmd);
        return;
      }
      if (cmd === OPENGD77_WRITE_CMD_FINISH_SECTOR) {
        this.enqueueWriteAck(cmd);
        return;
      }
    }
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    void timeoutMs;
    if (this.readBuf.length < n) {
      throw new Error(`OpenGd77ScriptedPipe: needed ${n} bytes, have ${this.readBuf.length}`);
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

  flashByte(abs: number): number | undefined {
    return this.flash.get(abs);
  }
}

describe('parseFirmwareInfo', () => {
  it('parses radioType and revision', () => {
    const info = parseFirmwareInfo(makeFirmwareInfoPayload(0x08));
    expect(info.radioType).toBe(0x08);
    expect(info.fwRevision).toBe('R20240101000000');
  });
});

describe('OpenGd77Protocol', () => {
  it('connects, downloads registered spans, rejects wrong radioType', async () => {
    const bad = new OpenGd77ScriptedPipe(0x05); // MD-9600
    const protoBad = new OpenGd77Protocol();
    await expect(protoBad.connect(bad)).rejects.toThrow(/radioType/);

    const pipe = new OpenGd77ScriptedPipe(0x08);
    pipe.plantByte(OPENUV380_OFFSET.channelBank0 + 0x10, 0xaa);
    const proto = new OpenGd77Protocol();
    const ident = await proto.connect(pipe);
    expect(ident.firmwareHint).toBe('R20240101000000');

    const image = await proto.download({});
    expect(readAbs(image, OPENUV380_OFFSET.channelBank0 + 0x10, 1)[0]).toBe(0xaa);
  });

  it('uploads dirty flash sectors with X framing', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe);
    const prior = await proto.download({});

    const next = createOpenUv380Image();
    next.bytes.set(prior.bytes);
    encodeChannelsIntoImage(next, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'UP',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'NFM',
        mode: 'analog',
      },
    ]);

    await proto.upload(next, {});

    const setSectorWrites = pipe.writes.filter(
      (w) => w[0] === OPENGD77_TYPE_WRITE_UV380 && w[1] === OPENGD77_WRITE_CMD_SET_SECTOR,
    );
    expect(setSectorWrites.length).toBeGreaterThan(0);

    const bufferWrites = pipe.writes.filter(
      (w) => w[0] === OPENGD77_TYPE_WRITE_UV380 && w[1] === OPENGD77_WRITE_CMD_SECTOR_BUFFER,
    );
    expect(bufferWrites.length).toBe(setSectorWrites.length * (OPENGD77_SECTOR / OPENGD77_BLOCK));
  });
});
