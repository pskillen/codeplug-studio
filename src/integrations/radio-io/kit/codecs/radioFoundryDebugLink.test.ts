import { describe, expect, it } from 'vitest';
import { RadioTimeoutError } from '../errors.ts';
import { crc16CcittFalse } from '../checksums.ts';
import type { BytePipe } from '../types.ts';
import { decodeDebugFrame, encodeDebugFrame, readDebugFrame } from './radioFoundryDebugLink.ts';

describe('RadioFoundry debug-link frames', () => {
  it('matches the spec INFO request, including CRC-16/CCITT-FALSE', () => {
    const frame = encodeDebugFrame(0x1c, 0x31, Uint8Array.of(0x00));
    expect([...frame]).toEqual([0xa5, 0x5a, 0x1c, 0x31, 0x01, 0x00, 0x00, 0x10, 0xf3]);
    expect(crc16CcittFalse(frame.subarray(2, 7))).toBe(0xf310);
    expect(decodeDebugFrame(frame)).toMatchObject({ command: 0x1c, seq: 0x31 });
  });

  it('rejects a frame whose CRC was flipped', () => {
    const frame = encodeDebugFrame(0x1c, 0x01, Uint8Array.of(0x07));
    frame[frame.length - 1] ^= 0xff;
    expect(() => decodeDebugFrame(frame)).toThrow(/CRC/);
  });
});

class FramePipe implements BytePipe {
  private pending = new Uint8Array(0);

  constructor(
    private readonly junk: Uint8Array,
    private readonly frame: Uint8Array,
  ) {}

  async readExact(n: number, _timeoutMs?: number): Promise<Uint8Array> {
    void _timeoutMs;
    if (this.pending.length === 0) {
      const combined = new Uint8Array(this.junk.length + this.frame.length);
      combined.set(this.junk, 0);
      combined.set(this.frame, this.junk.length);
      this.pending = combined;
    }
    if (this.pending.length < n) throw new RadioTimeoutError();
    const out = this.pending.slice(0, n);
    this.pending = this.pending.slice(n);
    return out;
  }

  async write(): Promise<void> {}
  async close(): Promise<void> {}
}

class StalledPipe implements BytePipe {
  private pending = new Uint8Array(0);

  enqueue(bytes: Uint8Array): void {
    const next = new Uint8Array(this.pending.length + bytes.length);
    next.set(this.pending, 0);
    next.set(bytes, this.pending.length);
    this.pending = next;
  }

  async readExact(n: number, timeoutMs?: number): Promise<Uint8Array> {
    if (this.pending.length < n) throw new RadioTimeoutError();
    if (timeoutMs !== undefined && timeoutMs <= 0) throw new RadioTimeoutError();
    const out = this.pending.slice(0, n);
    this.pending = this.pending.slice(n);
    return out;
  }

  async write(): Promise<void> {}
  async close(): Promise<void> {}
}

describe('readDebugFrame', () => {
  it('returns a frame after junk bytes before A5 5A', async () => {
    const frame = encodeDebugFrame(0x1c, 0x2a, Uint8Array.of(0x00));
    const pipe = new FramePipe(Uint8Array.of(0x00, 0x11, 0xa4), frame);
    const decoded = await readDebugFrame(pipe, 5000);
    expect(decoded).toMatchObject({ command: 0x1c, seq: 0x2a });
  });

  it('throws RadioTimeoutError when bytes stop', async () => {
    const pipe = new StalledPipe();
    pipe.enqueue(Uint8Array.of(0xa5));
    await expect(readDebugFrame(pipe, 1)).rejects.toBeInstanceOf(RadioTimeoutError);
  });

  it('rejects a length over 1024', async () => {
    const pipe = new StalledPipe();
    pipe.enqueue(Uint8Array.of(0xa5, 0x5a, 0x1c, 0x01, 0x01, 0x05));
    await expect(readDebugFrame(pipe, 5000)).rejects.toThrow(
      'RadioFoundry codeplug reply is too long.',
    );
  });

  it('rejects a bad CRC', async () => {
    const frame = encodeDebugFrame(0x1c, 0x01, Uint8Array.of(0x07));
    frame[frame.length - 1] ^= 0xff;
    const pipe = new FramePipe(new Uint8Array(0), frame);
    await expect(readDebugFrame(pipe, 5000)).rejects.toThrow(
      'RadioFoundry codeplug reply CRC does not match.',
    );
  });
});
