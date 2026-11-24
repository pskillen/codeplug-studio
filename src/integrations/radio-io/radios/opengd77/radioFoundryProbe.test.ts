import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { RadioTimeoutError, RadioWrongIdentError } from '../../kit/errors.ts';
import { decodeDebugFrame, encodeDebugFrame } from '../../kit/codecs/radioFoundryDebugLink.ts';
import {
  OPENGD77_RADIOFOUNDRY_PROBE_FRAME,
  OPENGD77_RADIOFOUNDRY_REFUSAL,
  probeRadioFoundry,
  RadioFoundryDetectedError,
} from './radioFoundryProbe.ts';

const framesEqual = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

class ProbeFakePipe implements BytePipe {
  queue: number[] = [];

  async write(data: Uint8Array): Promise<void> {
    if (framesEqual(data, OPENGD77_RADIOFOUNDRY_PROBE_FRAME)) {
      this.onProbeWrite();
    }
  }

  onProbeWrite(): void {}

  async readExact(n: number): Promise<Uint8Array> {
    if (this.queue.length < n) {
      throw new RadioTimeoutError(`ProbeFakePipe: needed ${n} bytes, have ${this.queue.length}`);
    }
    const out = Uint8Array.from(this.queue.splice(0, n));
    return out;
  }

  async drain(): Promise<Uint8Array> {
    const pending = Uint8Array.from(this.queue);
    this.queue = [];
    return pending;
  }

  async close(): Promise<void> {}
}

describe('RadioFoundryDetectedError', () => {
  it('is a RadioWrongIdentError with the write-path message and name', () => {
    const err = new RadioFoundryDetectedError();
    expect(err).toBeInstanceOf(RadioWrongIdentError);
    expect(err.message).toBe(OPENGD77_RADIOFOUNDRY_REFUSAL);
    expect(err.name).toBe('RadioWrongIdentError');
  });
});

describe('OPENGD77_RADIOFOUNDRY_PROBE_FRAME', () => {
  it('is one fixed PING frame', () => {
    expect(OPENGD77_RADIOFOUNDRY_PROBE_FRAME.length).toBe(8);
    expect(Array.from(OPENGD77_RADIOFOUNDRY_PROBE_FRAME.subarray(0, 6))).toEqual([
      0xa5, 0x5a, 0x01, 0x01, 0x00, 0x00,
    ]);
    const decoded = decodeDebugFrame(OPENGD77_RADIOFOUNDRY_PROBE_FRAME);
    expect(decoded.command).toBe(1);
    expect(decoded.seq).toBe(1);
    expect(decoded.payload).toEqual(new Uint8Array(0));
  });
});

describe('probeRadioFoundry', () => {
  it('is true for a RadioFoundry PING echo', async () => {
    const pipe = new ProbeFakePipe();
    pipe.onProbeWrite = () => {
      pipe.queue.push(...encodeDebugFrame(0x81, 1, new Uint8Array(0)));
    };
    expect(await probeRadioFoundry(pipe)).toBe(true);
  });

  it('is false for an OpenGD77 dash, silence, a garbled frame and A5 followed by junk', async () => {
    const dash = new ProbeFakePipe();
    dash.onProbeWrite = () => dash.queue.push(0x2d);
    expect(await probeRadioFoundry(dash)).toBe(false);

    const silent = new ProbeFakePipe();
    expect(await probeRadioFoundry(silent)).toBe(false);

    const garbled = new ProbeFakePipe();
    garbled.onProbeWrite = () => {
      const echo = encodeDebugFrame(0x81, 1, new Uint8Array(0));
      echo[echo.length - 1]! ^= 0xff;
      garbled.queue.push(...echo);
    };
    expect(await probeRadioFoundry(garbled)).toBe(false);

    const junk = new ProbeFakePipe();
    junk.onProbeWrite = () => junk.queue.push(0xa5, 0x00, 0x00);
    expect(await probeRadioFoundry(junk)).toBe(false);
  });

  it('empties the pipe afterwards', async () => {
    const dash = new ProbeFakePipe();
    dash.onProbeWrite = () => dash.queue.push(0x2d, 0x2d);
    await probeRadioFoundry(dash);
    await expect(dash.readExact(1)).rejects.toThrow(RadioTimeoutError);

    const echo = new ProbeFakePipe();
    echo.onProbeWrite = () => {
      echo.queue.push(...encodeDebugFrame(0x81, 1, new Uint8Array(0)), 0x99);
    };
    await probeRadioFoundry(echo);
    await expect(echo.readExact(1)).rejects.toThrow(RadioTimeoutError);
  });
});
