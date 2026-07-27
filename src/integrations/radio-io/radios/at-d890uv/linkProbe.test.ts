import { describe, expect, it } from 'vitest';
import { AtD890ScriptedPipe } from './__fixtures__/scriptedPipe.ts';
import {
  AT_D890_BLOCK_CANDIDATES,
  benchmarkAtD890Sweep,
  estimateAtD890RmwCost,
  negotiateAtD890ReadBlockSize,
  profileAtD890AccessPattern,
  profileAtD890Link,
} from './linkProbe.ts';
import { ANYTONE_DMR_ACK, anytoneDmrChecksum8AfterOpcode } from '../../kit/codecs/anytoneDmrRw.ts';

const ADDRESS = 0x180_0000;
const MAX = Math.max(...AT_D890_BLOCK_CANDIDATES);

/** Deterministic, position-dependent content so a wrong-length reply cannot match by luck. */
function content(length: number, offset = 0): Uint8Array {
  return new Uint8Array(length).map((_, i) => (i + offset) & 0xff);
}

/** A read reply carrying `payload` — mirrors the radio's framing. */
function reply(address: number, payload: Uint8Array): Uint8Array {
  const body = new Uint8Array(6 + payload.length);
  body[0] = 0x57;
  body[1] = (address >>> 24) & 0xff;
  body[2] = (address >>> 16) & 0xff;
  body[3] = (address >>> 8) & 0xff;
  body[4] = address & 0xff;
  body[5] = payload.length & 0xff;
  body.set(payload, 6);
  const frame = new Uint8Array(body.length + 2);
  frame.set(body, 0);
  frame[body.length] = anytoneDmrChecksum8AfterOpcode(body);
  frame[body.length + 1] = ANYTONE_DMR_ACK;
  return frame;
}

/**
 * Script a radio that honours block sizes up to `maxBlock`.
 * Uses on-demand read replies so probe failures do not consume pre-queued timing data.
 */
function scriptLink(maxBlock: number, iterations: number): AtD890ScriptedPipe {
  void iterations;
  const pipe = new AtD890ScriptedPipe();
  const full = content(MAX);
  pipe.readResponder = (addr, len) => {
    const off = addr - ADDRESS;
    if (off < 0 || off + len > full.length) return null;
    if (len > maxBlock) return null;
    return full.subarray(off, off + len);
  };
  return pipe;
}

describe('profileAtD890Link', () => {
  it('never writes to the radio', async () => {
    const pipe = scriptLink(MAX, 2);
    await profileAtD890Link(pipe, ADDRESS, { iterations: 2 });
    const writeFrames = pipe.writes.filter((w) => w[0] === 0x57 && w.length > 6);
    expect(writeFrames).toEqual([]);
  });

  it('finds the largest honoured block size', async () => {
    const profile = await profileAtD890Link(scriptLink(MAX, 2), ADDRESS, { iterations: 2 });
    expect(profile.bestBlockSize).toBe(MAX);
    expect(profile.trials.filter((t) => t.ok)).toHaveLength(AT_D890_BLOCK_CANDIDATES.length);
  });

  it('stops at the largest size the radio actually answers', async () => {
    const profile = await profileAtD890Link(scriptLink(0x40, 2), ADDRESS, { iterations: 2 });
    expect(profile.bestBlockSize).toBe(0x40);
    expect(profile.trials.find((t) => t.blockSize === 0x80)?.ok).toBe(false);
  });

  it('falls back to 16-byte blocks when nothing larger works', async () => {
    const profile = await profileAtD890Link(scriptLink(0x10, 2), ADDRESS, { iterations: 2 });
    expect(profile.bestBlockSize).toBe(0x10);
    // Only the 16-byte trial may pass; speedup is a wall-clock ratio and is not asserted
    // here because both timing loops measure the same scripted path plus scheduler noise.
    expect(profile.trials.filter((t) => t.ok).map((t) => t.blockSize)).toEqual([0x10]);
  });

  it('rejects a reply whose bytes disagree with the 16-byte baseline', async () => {
    const pipe = new AtD890ScriptedPipe();
    const iterations = 2;
    const full = content(MAX);
    pipe.readResponder = (addr, len) => {
      const off = addr - ADDRESS;
      if (off < 0 || off + len > full.length) return null;
      if (len === 0x20) return content(0x20, 0x55);
      if (len > 0x10) return null;
      return full.subarray(off, off + len);
    };

    const profile = await profileAtD890Link(pipe, ADDRESS, { iterations });
    const trial = profile.trials.find((t) => t.blockSize === 0x20);
    expect(trial?.ok).toBe(false);
    expect(trial?.detail).toMatch(/did not match the 16-byte baseline/);
    expect(profile.bestBlockSize).toBe(0x10);
  });
});

describe('negotiateAtD890ReadBlockSize', () => {
  it('returns the largest honoured block size without timing loops', async () => {
    const pipe = scriptLink(MAX, 2);
    const result = await negotiateAtD890ReadBlockSize(pipe, ADDRESS);
    expect(result.bestBlockSize).toBe(MAX);
    expect(result.trials.every((t) => t.msPerFrame === undefined)).toBe(true);
  });

  it('falls back to 16 bytes when larger blocks are rejected', async () => {
    const pipe = scriptLink(0x10, 2);
    const result = await negotiateAtD890ReadBlockSize(pipe, ADDRESS);
    expect(result.bestBlockSize).toBe(0x10);
  });
});

describe('benchmarkAtD890Sweep', () => {
  it('sweeps forward contiguously and reports the span it covered', async () => {
    const pipe = new AtD890ScriptedPipe();
    const blockSize = 0x40;
    const frames = 8;
    for (let i = 0; i < frames; i++) {
      pipe.enqueue(reply(ADDRESS + i * blockSize, content(blockSize)));
    }
    const r = await benchmarkAtD890Sweep(pipe, ADDRESS, frames * blockSize, blockSize);

    expect(r.bytes).toBe(frames * blockSize);
    expect(r.blockSize).toBe(blockSize);
    expect(r.bytesPerSecond).toBeGreaterThan(0);
    // Addresses must advance by blockSize, never repeat.
    const requested = pipe.writes
      .filter((w) => w[0] === 0x52)
      .map((w) => ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0);
    expect(requested).toEqual(Array.from({ length: frames }, (_, i) => ADDRESS + i * blockSize));
  });

  it('rounds a partial trailing block up rather than under-reading', async () => {
    const pipe = new AtD890ScriptedPipe();
    for (let i = 0; i < 3; i++) pipe.enqueue(reply(ADDRESS + i * 0x40, content(0x40)));
    const r = await benchmarkAtD890Sweep(pipe, ADDRESS, 0x81, 0x40);
    expect(r.bytes).toBe(3 * 0x40);
  });
});

describe('profileAtD890AccessPattern', () => {
  /** Enough replies for every stride trial; content is irrelevant to timing. */
  function scriptStrides(iterations: number): AtD890ScriptedPipe {
    const pipe = new AtD890ScriptedPipe();
    for (let i = 0; i < 8 * iterations; i++) pipe.enqueue(reply(ADDRESS, content(0x10)));
    return pipe;
  }

  it('never writes to the radio', async () => {
    const pipe = scriptStrides(2);
    await profileAtD890AccessPattern(pipe, ADDRESS, { iterations: 2 });
    expect(pipe.writes.every((w) => w[0] === 0x52)).toBe(true);
  });

  it('samples every stride once', async () => {
    const r = await profileAtD890AccessPattern(scriptStrides(2), ADDRESS, { iterations: 2 });
    expect(r.samples.map((s) => s.stride)).toEqual([
      0x10, 0x40, 0x100, 0x400, 0x800, 0x1000, 0x2000, 0x4000,
    ]);
  });

  it('declines to infer a page size from a flat latency curve', async () => {
    // A scripted pipe answers instantly at every stride, so there is no cache signal.
    const r = await profileAtD890AccessPattern(scriptStrides(2), ADDRESS, { iterations: 2 });
    expect(r.inferredPageBytes).toBeNull();
  });
});

describe('estimateAtD890RmwCost', () => {
  const base = {
    unitBytes: 0x10000,
    touchedUnits: 14,
    readBytesPerSecond: 30_000,
    stageBytesPerSecond: 120_000,
    commitSeconds: 15,
  };

  it('prices reads and staging separately rather than at one rate', () => {
    const cost = estimateAtD890RmwCost(base);
    const bytes = 0x10000 * 14;
    expect(cost.readSeconds).toBeCloseTo(bytes / 30_000, 3);
    expect(cost.stageSeconds).toBeCloseTo(bytes / 120_000, 3);
    // Staging reaches RAM only, so it must not be charged the flash read rate.
    expect(cost.stageSeconds).toBeLessThan(cost.readSeconds);
  });

  it('adds the radio-side commit as a flat cost, not a per-byte one', () => {
    const small = estimateAtD890RmwCost({ ...base, touchedUnits: 1 });
    const large = estimateAtD890RmwCost({ ...base, touchedUnits: 14 });
    expect(small.commitSeconds).toBe(large.commitSeconds);
    expect(large.totalSeconds).toBeGreaterThan(small.totalSeconds);
  });

  it('sums to the total', () => {
    const c = estimateAtD890RmwCost(base);
    expect(c.totalSeconds).toBeCloseTo(c.readSeconds + c.stageSeconds + c.commitSeconds, 6);
  });

  it('returns Infinity rather than NaN for a dead link', () => {
    expect(estimateAtD890RmwCost({ ...base, readBytesPerSecond: 0 }).totalSeconds).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
