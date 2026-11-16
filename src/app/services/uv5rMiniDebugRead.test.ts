import { describe, expect, it } from 'vitest';

import { RadioClosedError, RadioTimeoutError } from '@integrations/radio-io/kit/errors.ts';
import { isUv5rMiniDebugFrameAllowed } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { FakeMiniRadio } from '@integrations/radio-io/radios/uv5r-mini/__fixtures__/fakeMiniRadio.ts';
import type { SerialPortLike } from '@integrations/radio-io/transport/index.ts';
import type { BytePipe } from '@integrations/radio-io/types.ts';

import { runUv5rMiniDebugFullRead } from './uv5rMiniDebugRead.ts';

/** A cable with no radio answering at this rate. */
class SilentPipe implements BytePipe {
  closed = false;
  async write(): Promise<void> {}
  async readExact(): Promise<Uint8Array> {
    throw new RadioTimeoutError('silent');
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

const port = { close: async () => undefined } as unknown as SerialPortLike;

function radio(): FakeMiniRadio {
  const r = new FakeMiniRadio();
  for (let i = 0; i < r.flash.length; i++) r.flash[i] = (i * 5) & 0xff;
  r.plainFrom = 0xf000;
  return r;
}

describe('runUv5rMiniDebugFullRead', () => {
  it('reads the radio at 115200 and sends only allowlisted frames', async () => {
    const fake = radio();
    const bauds: number[] = [];
    const read = await runUv5rMiniDebugFullRead({
      port,
      settleScale: 0,
      open: async (baud) => {
        bauds.push(baud);
        return fake;
      },
    });
    expect(bauds).toEqual([115200]);
    expect(read.decoded).toEqual(fake.flash);
    expect(fake.writes.every(isUv5rMiniDebugFrameAllowed)).toBe(true);
    expect(fake.wAddresses()).toEqual([]);
  });

  it('retries once at 38400 when 115200 gets no answer, as the codeplug session does', async () => {
    const fake = radio();
    const silent = new SilentPipe();
    const bauds: number[] = [];
    const read = await runUv5rMiniDebugFullRead({
      port,
      settleScale: 0,
      open: async (baud) => {
        bauds.push(baud);
        return baud === 115200 ? silent : fake;
      },
    });
    expect(bauds).toEqual([115200, 38400]);
    expect(silent.closed).toBe(true);
    expect(read.spans).toHaveLength(5);
  });
});

it('closes the pipe when a read is cancelled or fails', async () => {
  for (const mode of ['cancel', 'error'] as const) {
    const fake = radio();
    let closed = false;
    const abort = new AbortController();
    const close = fake.close.bind(fake);
    fake.close = async () => {
      closed = true;
      await close();
    };
    const result = runUv5rMiniDebugFullRead({
      port,
      settleScale: 0,
      open: async () => fake,
      signal: abort.signal,
      onProgress: () => {
        if (mode === 'cancel') abort.abort();
        else throw new Error('synthetic failure');
      },
    });
    await expect(result).rejects.toThrow();
    expect(closed).toBe(true);
  }
});

describe('runUv5rMiniDebugFullRead on Firefox + CH340', () => {
  it('on a readable that ends right after open (Firefox + CH340): opens once, sends the ident once, names the driver', async () => {
    const opens: number[] = [];
    const written: Uint8Array[] = [];
    let readable: ReadableStream<Uint8Array> | null = null;
    let writable: WritableStream<Uint8Array> | null = null;
    const closing: SerialPortLike = {
      get readable() {
        return readable;
      },
      get writable() {
        return writable;
      },
      async open({ baudRate }) {
        opens.push(baudRate);
        readable = new ReadableStream<Uint8Array>({ start: (c) => c.close() });
        writable = new WritableStream<Uint8Array>({
          write: (chunk) => void written.push(chunk.slice()),
        });
      },
      async close() {
        readable = null;
        writable = null;
      },
      async setSignals() {},
    };
    const err = await runUv5rMiniDebugFullRead({ port: closing, settleScale: 0 }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(RadioClosedError);
    expect((err as Error).message).toMatch(/CH340 driver/);
    expect(opens).toEqual([115200]);
    expect(written.filter((w) => new TextDecoder().decode(w) === 'PROGRAMCOLORPROU')).toHaveLength(
      1,
    );
  });
});
