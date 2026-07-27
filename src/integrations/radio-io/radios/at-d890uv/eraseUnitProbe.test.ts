import { describe, expect, it } from 'vitest';
import {
  AT_D890_PROBE,
  analyseAtD890EraseUnit,
  assertAtD890ProbeSpanUnused,
  classifyAtD890Sentinel,
  estimateAtD890RmwSeconds,
  isAtD890RealAddress,
  listAtD890ProbeSentinels,
  makeAtD890ProbeMarker,
  makeAtD890ProbeSentinel,
  summariseAtD890Throughput,
  verifyAtD890Paint,
  type AtD890SentinelReading,
} from './eraseUnitProbe.ts';
import { AT_D890_LIMITS } from './constants.ts';
import { isAtD890WritableAddress } from './writableExtents.ts';

const sentinels = listAtD890ProbeSentinels();

/** Simulate a radio whose erase unit is `unitBytes`, after the marker write commits. */
function readAfterErase(unitBytes: number): AtD890SentinelReading[] {
  const unitStart = Math.floor(AT_D890_PROBE.MARKER_ADDRESS / unitBytes) * unitBytes;
  const unitEnd = unitStart + unitBytes;
  return sentinels.map(({ address }) => ({
    address,
    state: address >= unitStart && address < unitEnd ? 'erased' : 'intact',
  }));
}

describe('probe geometry', () => {
  it('samples only backed storage, never a mirrored upper half', () => {
    const perBlock = AT_D890_PROBE.REAL_BYTES_PER_BLOCK / AT_D890_PROBE.SENTINEL_STRIDE;
    expect(sentinels).toHaveLength(perBlock * AT_D890_PROBE.BLOCK_COUNT);
    expect(sentinels.every((s) => isAtD890RealAddress(s.address))).toBe(true);
    expect(sentinels[0]!.address).toBe(AT_D890_PROBE.SPAN_START);
  });

  it('never emits two addresses that alias onto one cell', () => {
    const seen = new Set<number>();
    for (const { address } of sentinels) {
      // Aliasing folds an address onto the low half of its block.
      const block = Math.floor((address - AT_D890_PROBE.SPAN_START) / AT_D890_PROBE.BLOCK_STRIDE);
      const offset = (address - AT_D890_PROBE.SPAN_START) % AT_D890_PROBE.REAL_BYTES_PER_BLOCK;
      const cell = block * AT_D890_PROBE.REAL_BYTES_PER_BLOCK + offset;
      expect(seen.has(cell)).toBe(false);
      seen.add(cell);
    }
  });

  it('keeps the marker in backed storage', () => {
    expect(isAtD890RealAddress(AT_D890_PROBE.MARKER_ADDRESS)).toBe(true);
  });

  it('keeps every written address inside the write allow-list', () => {
    for (const { address } of sentinels) {
      expect(isAtD890WritableAddress(address)).toBe(true);
    }
    expect(isAtD890WritableAddress(AT_D890_PROBE.MARKER_ADDRESS)).toBe(true);
  });

  it('places the marker off the sentinel grid so it destroys no sentinel of its own', () => {
    expect(AT_D890_PROBE.MARKER_ADDRESS % AT_D890_PROBE.SENTINEL_STRIDE).not.toBe(0);
    expect(AT_D890_PROBE.MARKER_ADDRESS % 16).toBe(0);
  });

  it('brackets an erase unit up to one block of backed storage', () => {
    const marker = AT_D890_PROBE.MARKER_ADDRESS;
    const blockBase =
      AT_D890_PROBE.SPAN_START +
      Math.floor((marker - AT_D890_PROBE.SPAN_START) / AT_D890_PROBE.BLOCK_STRIDE) *
        AT_D890_PROBE.BLOCK_STRIDE;
    // Sentinels exist both below and above the marker inside its own block's real half.
    expect(sentinels.some((s) => s.address >= blockBase && s.address < marker)).toBe(true);
    expect(
      sentinels.some(
        (s) => s.address > marker && s.address < blockBase + AT_D890_PROBE.REAL_BYTES_PER_BLOCK,
      ),
    ).toBe(true);
  });

  it('tags sentinel and marker blocks distinguishably', () => {
    const addr = AT_D890_PROBE.SPAN_START;
    expect(makeAtD890ProbeSentinel(addr)).toHaveLength(16);
    expect(makeAtD890ProbeMarker(addr)).not.toEqual(makeAtD890ProbeSentinel(addr));
  });
});

describe('classifyAtD890Sentinel', () => {
  const addr = AT_D890_PROBE.SPAN_START + AT_D890_PROBE.SENTINEL_STRIDE;

  it('recognises an intact sentinel', () => {
    expect(classifyAtD890Sentinel(addr, makeAtD890ProbeSentinel(addr))).toBe('intact');
  });

  it('recognises erased flash', () => {
    expect(classifyAtD890Sentinel(addr, new Uint8Array(16).fill(0xff))).toBe('erased');
  });

  it('flags a sentinel carrying the wrong address rather than accepting it', () => {
    expect(classifyAtD890Sentinel(addr, makeAtD890ProbeSentinel(addr + 0x2000))).toBe('unexpected');
  });
});

describe('assertAtD890ProbeSpanUnused', () => {
  it('passes on a bitmap with only low channel slots occupied', () => {
    const set = new Uint8Array(AT_D890_LIMITS.CHANNEL_SET_BYTES);
    for (let slot = 0; slot < 200; slot++) set[slot >> 3]! |= 1 << (slot % 8);
    expect(() => assertAtD890ProbeSpanUnused(set)).not.toThrow();
  });

  it('refuses when a slot inside the probe span is occupied', () => {
    const set = new Uint8Array(AT_D890_LIMITS.CHANNEL_SET_BYTES);
    const slot = AT_D890_PROBE.FIRST_CHANNEL_SLOT + 5;
    set[slot >> 3]! |= 1 << (slot % 8);
    expect(() => assertAtD890ProbeSpanUnused(set)).toThrow(/occupied inside the probe span/);
  });

  it('ignores slots just past the span', () => {
    const set = new Uint8Array(AT_D890_LIMITS.CHANNEL_SET_BYTES);
    const slot = AT_D890_PROBE.LAST_CHANNEL_SLOT + 1;
    set[slot >> 3]! |= 1 << (slot % 8);
    expect(() => assertAtD890ProbeSpanUnused(set)).not.toThrow();
  });
});

describe('verifyAtD890Paint', () => {
  it('passes when every sentinel survived the commit', () => {
    const readings = sentinels.map(({ address }) => ({ address, state: 'intact' as const }));
    expect(verifyAtD890Paint(readings)).toMatchObject({ ok: true, erased: 0, unexpected: 0 });
  });

  it('fails when same-session writes did not coexist', () => {
    const readings = sentinels.map(({ address }, i) => ({
      address,
      state: i === 0 ? ('intact' as const) : ('erased' as const),
    }));
    expect(verifyAtD890Paint(readings).ok).toBe(false);
  });
});

describe('analyseAtD890EraseUnit', () => {
  it.each([0x2000, 0x4000, 0x10000, 0x20000])(
    'recovers a 0x%s unit exactly, inside one block',
    (unitBytes) => {
      const result = analyseAtD890EraseUnit(readAfterErase(unitBytes));
      expect(result.unitBytes).toBe(unitBytes);
      expect(result.unitStart).toBe(
        Math.floor(AT_D890_PROBE.MARKER_ADDRESS / unitBytes) * unitBytes,
      );
      expect(result.aligned).toBe(true);
      expect(result.truncatedBySpan).toBe(false);
      expect(result.spansBlockGap).toBe(false);
      expect(AT_D890_PROBE.MARKER_ADDRESS).toBeGreaterThanOrEqual(result.unitStart);
      expect(AT_D890_PROBE.MARKER_ADDRESS).toBeLessThan(result.unitEnd);
    },
  );

  it('counts backed bytes, not address span, when a run crosses a block boundary', () => {
    // Erase everything: the run covers all three blocks' real halves plus the gaps between.
    const readings = sentinels.map(({ address }) => ({ address, state: 'erased' as const }));
    const result = analyseAtD890EraseUnit(readings);

    expect(result.unitBytes).toBe(AT_D890_PROBE.REAL_BYTES_PER_BLOCK * AT_D890_PROBE.BLOCK_COUNT);
    expect(result.addressSpan).toBeGreaterThan(result.unitBytes);
    expect(result.spansBlockGap).toBe(true);
  });

  it('reports truncation when the erased run reaches a span edge', () => {
    const readings = sentinels.map(({ address }) => ({ address, state: 'erased' as const }));
    expect(analyseAtD890EraseUnit(readings).truncatedBySpan).toBe(true);
  });

  it('throws when no erase was observed, rather than reporting a bogus unit', () => {
    const readings = sentinels.map(({ address }) => ({ address, state: 'intact' as const }));
    expect(() => analyseAtD890EraseUnit(readings)).toThrow(/no erase was observed/);
  });

  it('throws on an empty reading set', () => {
    expect(() => analyseAtD890EraseUnit([])).toThrow(/no sentinel readings/);
  });
});

describe('throughput', () => {
  it('converts a timed frame run into rates', () => {
    const t = summariseAtD890Throughput({ frames: 1000, elapsedMs: 2000 });
    expect(t.framesPerSecond).toBeCloseTo(500);
    expect(t.msPerFrame).toBeCloseTo(2);
    expect(t.payloadBytesPerSecond).toBeCloseTo(8000);
  });

  it('returns zeroes rather than NaN for an empty sample', () => {
    expect(summariseAtD890Throughput({ frames: 0, elapsedMs: 0 })).toEqual({
      framesPerSecond: 0,
      msPerFrame: 0,
      payloadBytesPerSecond: 0,
    });
  });

  it('costs a full RMW pass from the measured rate', () => {
    // 14 units of 0x10000 at 3000 frames/s: 14 * 4096 * 2 / 3000.
    expect(estimateAtD890RmwSeconds(0x10000, 14, 3000)).toBeCloseTo(38.2, 1);
  });
});
