import { describe, expect, it } from 'vitest';

import { RadioTimeoutError } from '@integrations/radio-io/kit/errors.ts';
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
