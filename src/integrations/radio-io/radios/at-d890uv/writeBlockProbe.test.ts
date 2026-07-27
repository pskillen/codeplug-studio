import { describe, expect, it } from 'vitest';
import {
  AT_D890_WRITE_BLOCK_CANDIDATES,
  atD890WriteProbeAddress,
  buildAtD890WriteTrials,
  classifyAtD890WriteReadback,
  makeAtD890WritePayload,
  summariseAtD890WriteProbe,
  type AtD890WriteTrialResult,
} from './writeBlockProbe.ts';
import { AT_D890_PROBE, isAtD890RealAddress, listAtD890ProbeSentinels } from './eraseUnitProbe.ts';
import { isAtD890WritableAddress } from './writableExtents.ts';

const trials = buildAtD890WriteTrials();
const MAX = Math.max(...AT_D890_WRITE_BLOCK_CANDIDATES);

describe('write probe geometry', () => {
  it('keeps every trial address in backed storage and inside the allow-list', () => {
    for (const { address, blockSize } of trials) {
      expect(isAtD890RealAddress(address)).toBe(true);
      // The whole frame, not just its first byte, must stay writable.
      for (let off = 0; off < blockSize; off += 16) {
        expect(isAtD890WritableAddress(address + off)).toBe(true);
      }
    }
  });

  it('spaces trials so the largest payload cannot reach the next one', () => {
    for (let i = 0; i < trials.length - 1; i++) {
      const end = trials[i]!.address + trials[i]!.blockSize;
      expect(end).toBeLessThanOrEqual(trials[i + 1]!.address);
    }
  });

  it('destroys no erase-unit sentinel', () => {
    const grid = new Set(listAtD890ProbeSentinels().map((s) => s.address));
    for (const { address, blockSize } of trials) {
      for (let off = 0; off < blockSize; off += 16) {
        expect(grid.has(address + off)).toBe(false);
      }
    }
  });

  it('stays inside the last probe block, away from the marker', () => {
    const lastBlockBase =
      AT_D890_PROBE.SPAN_START + (AT_D890_PROBE.BLOCK_COUNT - 1) * AT_D890_PROBE.BLOCK_STRIDE;
    for (const { address } of trials) {
      expect(address).toBeGreaterThanOrEqual(lastBlockBase);
      expect(address).toBeLessThan(lastBlockBase + AT_D890_PROBE.REAL_BYTES_PER_BLOCK);
    }
    expect(trials.some((t) => t.address === AT_D890_PROBE.MARKER_ADDRESS)).toBe(false);
  });

  it('orders trials ascending so a refusal stops before larger frames', () => {
    expect(trials.map((t) => t.blockSize)).toEqual([...AT_D890_WRITE_BLOCK_CANDIDATES]);
  });
});

describe('makeAtD890WritePayload', () => {
  it('produces the requested length', () => {
    for (const size of AT_D890_WRITE_BLOCK_CANDIDATES) {
      expect(makeAtD890WritePayload(atD890WriteProbeAddress(0), size)).toHaveLength(size);
    }
  });

  it('differs by address, so a write landing elsewhere is detectable', () => {
    const a = makeAtD890WritePayload(atD890WriteProbeAddress(0), MAX);
    const b = makeAtD890WritePayload(atD890WriteProbeAddress(1), MAX);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('differs by length beyond the shared prefix, so a truncated write is detectable', () => {
    const addr = atD890WriteProbeAddress(0);
    const short = makeAtD890WritePayload(addr, 0x10);
    const long = makeAtD890WritePayload(addr, MAX);
    expect(Array.from(long.subarray(0, 0x10))).not.toEqual(Array.from(short));
  });

  it('is position-dependent past the header, so zero padding cannot pass', () => {
    const p = makeAtD890WritePayload(atD890WriteProbeAddress(0), MAX);
    expect(p.subarray(16).every((b) => b === 0)).toBe(false);
  });
});

describe('classifyAtD890WriteReadback', () => {
  const addr = atD890WriteProbeAddress(2);

  it('matches an exact read-back', () => {
    const r = classifyAtD890WriteReadback(addr, 0x40, makeAtD890WritePayload(addr, 0x40));
    expect(r.outcome).toBe('match');
    expect(r.matchingPrefix).toBe(0x40);
  });

  it('reports erased flash distinctly from wrong bytes', () => {
    const r = classifyAtD890WriteReadback(addr, 0x40, new Uint8Array(0x40).fill(0xff));
    expect(r.outcome).toBe('erased');
  });

  it('locates where a short write stopped', () => {
    // Radio honoured only the first 16 bytes and left the rest erased.
    const data = new Uint8Array(0x40).fill(0xff);
    data.set(makeAtD890WritePayload(addr, 0x40).subarray(0, 16), 0);
    const r = classifyAtD890WriteReadback(addr, 0x40, data);
    expect(r.outcome).toBe('mismatch');
    expect(r.matchingPrefix).toBe(16);
  });

  it('rejects a payload written at a different address', () => {
    const other = makeAtD890WritePayload(atD890WriteProbeAddress(3), 0x40);
    expect(classifyAtD890WriteReadback(addr, 0x40, other).outcome).toBe('mismatch');
  });
});

describe('summariseAtD890WriteProbe', () => {
  function result(blockSize: number, readback: AtD890WriteTrialResult['readback']) {
    return { blockSize, address: 0, accepted: true, readback } as AtD890WriteTrialResult;
  }

  it('takes the largest size that matched, ignoring larger ones that did not', () => {
    const v = summariseAtD890WriteProbe([
      result(0x10, 'match'),
      result(0x20, 'match'),
      result(0x40, 'mismatch'),
    ]);
    expect(v.bestBlockSize).toBe(0x20);
    expect(v.speedup).toBe(2);
  });

  it('never credits a size the radio refused outright', () => {
    const v = summariseAtD890WriteProbe([
      result(0x10, 'match'),
      { blockSize: 0x20, address: 0, accepted: false, detail: 'no ACK' },
    ]);
    expect(v.bestBlockSize).toBe(0x10);
    expect(v.speedup).toBe(1);
  });

  it('falls back to 16 bytes when nothing matched', () => {
    const v = summariseAtD890WriteProbe([result(0x10, 'mismatch')]);
    expect(v.bestBlockSize).toBe(0x10);
    expect(v.speedup).toBe(1);
  });
});
