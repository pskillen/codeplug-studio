import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../types.ts';
import { FrameTrace, TracingPipe } from './frameTrace.ts';

function innerPipe(txBytesWritten?: number): BytePipe {
  return {
    txBytesWritten,
    async write() {},
    async readExact() {
      return new Uint8Array(0);
    },
    async close() {},
  } as BytePipe;
}

describe('TracingPipe TX offsets', () => {
  it('uses its own running count when the inner pipe has none', async () => {
    const trace = new FrameTrace();
    const pipe = new TracingPipe(innerPipe(), trace);
    await pipe.write(new Uint8Array([1, 2, 3]));
    await pipe.write(new Uint8Array([4]));
    expect(trace.snapshot().map((f) => f.text)).toEqual(['@0 01 02 03', '@3 04']);
  });

  it("prefers the inner pipe's cumulative txBytesWritten when present", async () => {
    const trace = new FrameTrace();
    const pipe = new TracingPipe(innerPipe(1000), trace);
    await pipe.write(new Uint8Array([1]));
    expect(trace.snapshot()[0]?.text).toBe('@1000 01');
  });
});
