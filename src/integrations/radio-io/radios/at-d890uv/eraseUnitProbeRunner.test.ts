import { describe, expect, it } from 'vitest';
import {
  AtD890ScriptedPipe,
  enqueueAtD890ReadReply,
  scriptAtD890Connect,
  scriptAtD890WriteAck,
} from './__fixtures__/scriptedPipe.ts';
import {
  runAtD890ProbeDiagnose,
  runAtD890ProbeInspect,
  runAtD890ProbeMeasure,
  runAtD890ProbePaint,
  runAtD890ProbeVerifyAndMark,
} from './eraseUnitProbeRunner.ts';
import {
  AT_D890_PROBE,
  listAtD890ProbeSentinels,
  makeAtD890ProbeMarker,
  makeAtD890ProbeSentinel,
} from './eraseUnitProbe.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';

const sentinels = listAtD890ProbeSentinels();
const ERASED = new Uint8Array(16).fill(0xff);

function writtenAddresses(pipe: AtD890ScriptedPipe): number[] {
  return pipe.writes
    .filter((w) => w[0] === 0x57 /* 'W' */ && w.length === 24)
    .map((w) => ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0);
}

function sentEnd(pipe: AtD890ScriptedPipe): boolean {
  return pipe.writes.some((w) => w.length === 3 && w[0] === 0x45 && w[1] === 0x4e && w[2] === 0x44);
}

describe('runAtD890ProbeInspect', () => {
  function scriptInspect(channelSet: Uint8Array, cell: (a: number) => Uint8Array) {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    enqueueAtD890ReadReply(pipe, D890_MAP.ChannelSet, channelSet);
    for (const { address } of sentinels) enqueueAtD890ReadReply(pipe, address, cell(address));
    return pipe;
  }

  it('never writes a single byte to the radio', async () => {
    const pipe = scriptInspect(new Uint8Array(AT_D890_LIMITS.CHANNEL_SET_BYTES), () => ERASED);
    await runAtD890ProbeInspect(pipe);
    expect(writtenAddresses(pipe)).toEqual([]);
  });

  it('reports a clean span as safe', async () => {
    const pipe = scriptInspect(new Uint8Array(AT_D890_LIMITS.CHANNEL_SET_BYTES), () => ERASED);
    const r = await runAtD890ProbeInspect(pipe);
    expect(r.occupiedSlots).toEqual([]);
    expect(r.nonEmptyCells).toEqual([]);
    expect(r.totalCells).toBe(sentinels.length);
  });

  it('surfaces occupied channel slots and live cells instead of proceeding silently', async () => {
    const channelSet = new Uint8Array(AT_D890_LIMITS.CHANNEL_SET_BYTES);
    const slot = AT_D890_PROBE.FIRST_CHANNEL_SLOT + 3;
    channelSet[slot >> 3]! |= 1 << (slot % 8);
    const live = sentinels[7]!.address;
    const pipe = scriptInspect(channelSet, (a) =>
      a === live ? makeAtD890ProbeSentinel(a) : ERASED,
    );

    const r = await runAtD890ProbeInspect(pipe);
    expect(r.occupiedSlots).toEqual([slot]);
    expect(r.nonEmptyCells).toEqual([live]);
    expect(writtenAddresses(pipe)).toEqual([]);
  });
});

describe('runAtD890ProbePaint', () => {
  function scriptPaint(channelSet: Uint8Array): AtD890ScriptedPipe {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    enqueueAtD890ReadReply(pipe, D890_MAP.ChannelSet, channelSet);
    scriptAtD890WriteAck(pipe, sentinels.length);
    return pipe;
  }

  it('writes the whole sentinel grid and commits', async () => {
    const pipe = scriptPaint(new Uint8Array(AT_D890_LIMITS.CHANNEL_SET_BYTES));
    const result = await runAtD890ProbePaint(pipe);

    expect(result.sentinelsWritten).toBe(sentinels.length);
    expect(writtenAddresses(pipe)).toEqual(sentinels.map((s) => s.address));
    expect(sentEnd(pipe)).toBe(true);
  });

  it('refuses to write anything when a channel slot inside the span is occupied', async () => {
    const channelSet = new Uint8Array(AT_D890_LIMITS.CHANNEL_SET_BYTES);
    const slot = AT_D890_PROBE.FIRST_CHANNEL_SLOT;
    channelSet[slot >> 3]! |= 1 << (slot % 8);
    const pipe = scriptPaint(channelSet);

    await expect(runAtD890ProbePaint(pipe)).rejects.toThrow(/occupied inside the probe span/);
    expect(writtenAddresses(pipe)).toEqual([]);
    expect(sentEnd(pipe)).toBe(false);
  });

  it('refuses a radio that is not an AT-D890UV', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.enqueue(new Uint8Array([0x51]));
    pipe.enqueue(new Uint8Array([0x58, 0x06]));
    pipe.enqueue(new TextEncoder().encode('D878UV2\0V100\0'));
    pipe.enqueue(new Uint8Array([0x06]));

    await expect(runAtD890ProbePaint(pipe)).rejects.toThrow(/expected ID890UV/);
    expect(writtenAddresses(pipe)).toEqual([]);
  });
});

describe('runAtD890ProbeVerifyAndMark', () => {
  function scriptVerify(states: (a: number) => Uint8Array): AtD890ScriptedPipe {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    for (const { address } of sentinels) enqueueAtD890ReadReply(pipe, address, states(address));
    scriptAtD890WriteAck(pipe, 1);
    return pipe;
  }

  it('writes exactly one marker once the grid is confirmed intact', async () => {
    const pipe = scriptVerify(makeAtD890ProbeSentinel);
    const result = await runAtD890ProbeVerifyAndMark(pipe);

    expect(result.ok).toBe(true);
    expect(result.markerWritten).toBe(true);
    expect(result.paint.intact).toBe(sentinels.length);
    expect(writtenAddresses(pipe)).toEqual([AT_D890_PROBE.MARKER_ADDRESS]);
    expect(sentEnd(pipe)).toBe(true);
  });

  it('writes no marker when the grid did not survive, and keeps the readings', async () => {
    const pipe = scriptVerify((a) =>
      a === sentinels[3]!.address ? ERASED : makeAtD890ProbeSentinel(a),
    );
    const result = await runAtD890ProbeVerifyAndMark(pipe);

    expect(result.ok).toBe(false);
    expect(result.markerWritten).toBe(false);
    expect(result.paint.erased).toBe(1);
    // The diagnosis must survive the failure rather than being discarded with a throw.
    expect(result.readings).toHaveLength(sentinels.length);
    expect(writtenAddresses(pipe)).toEqual([]);
  });

  it('reports aliasing rather than erasure when cells hold another address', async () => {
    const stride = 0x40000;
    const pipe = scriptVerify((a) =>
      makeAtD890ProbeSentinel((a - AT_D890_PROBE.SPAN_START) % 0x80000 < stride ? a + stride : a),
    );
    const result = await runAtD890ProbeVerifyAndMark(pipe);

    expect(result.ok).toBe(false);
    expect(result.paint.erased).toBe(0);
    expect(result.paint.unexpected).toBeGreaterThan(0);
    expect(result.alias.flat).toBe(false);
    expect(result.alias.aliasStride).toBe(stride);
    expect(writtenAddresses(pipe)).toEqual([]);
  });
});

describe('runAtD890ProbeDiagnose', () => {
  function scriptDiagnose(cell: (a: number) => Uint8Array): AtD890ScriptedPipe {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    for (const { address } of sentinels) enqueueAtD890ReadReply(pipe, address, cell(address));
    return pipe;
  }

  it('writes nothing', async () => {
    const pipe = scriptDiagnose(makeAtD890ProbeSentinel);
    await runAtD890ProbeDiagnose(pipe);
    expect(writtenAddresses(pipe)).toEqual([]);
  });

  it('recovers a single consistent alias stride', async () => {
    const stride = 0x40000;
    const r = await runAtD890ProbeDiagnose(
      scriptDiagnose((a) =>
        makeAtD890ProbeSentinel((a - AT_D890_PROBE.SPAN_START) % 0x80000 < stride ? a + stride : a),
      ),
    );

    expect(r.alias.aliasStride).toBe(stride);
    expect(r.alias.deltas).toEqual([{ delta: stride, count: r.alias.aliasedCells }]);
  });

  it('calls a genuinely flat span flat', async () => {
    const r = await runAtD890ProbeDiagnose(scriptDiagnose(makeAtD890ProbeSentinel));
    expect(r.alias.flat).toBe(true);
    expect(r.alias.aliasStride).toBeNull();
  });
});

describe('runAtD890ProbeMeasure', () => {
  function scriptMeasure(unitBytes: number): AtD890ScriptedPipe {
    const unitStart = Math.floor(AT_D890_PROBE.MARKER_ADDRESS / unitBytes) * unitBytes;
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    for (const { address } of sentinels) {
      const erased = address >= unitStart && address < unitStart + unitBytes;
      enqueueAtD890ReadReply(pipe, address, erased ? ERASED : makeAtD890ProbeSentinel(address));
    }
    return pipe;
  }

  // Sizes up to one block's backed storage; the grid skips each block's mirrored half, so
  // a larger unit is reported in backed bytes and flagged with `spansBlockGap`.
  it.each([0x2000, 0x10000, 0x20000])(
    'measures a 0x%s erase unit end to end',
    async (unitBytes) => {
      const { result, readThroughput } = await runAtD890ProbeMeasure(scriptMeasure(unitBytes));

      expect(result.unitBytes).toBe(unitBytes);
      expect(result.aligned).toBe(true);
      expect(result.truncatedBySpan).toBe(false);
      expect(result.spansBlockGap).toBe(false);
      expect(readThroughput.framesPerSecond).toBeGreaterThanOrEqual(0);
    },
  );

  it('reports an erase larger than one block in backed bytes, not address span', async () => {
    const { result } = await runAtD890ProbeMeasure(scriptMeasure(0x80000));

    // 0x80000 of address space covers only one block's 0x40000 of real storage.
    expect(result.unitBytes).toBe(AT_D890_PROBE.REAL_BYTES_PER_BLOCK);
    expect(result.spansBlockGap).toBe(false);
  });

  it('reads only, never writes', async () => {
    const pipe = scriptMeasure(0x10000);
    await runAtD890ProbeMeasure(pipe);
    expect(writtenAddresses(pipe)).toEqual([]);
  });
});

describe('probe block encoding', () => {
  it('keeps sentinel and marker blocks 16 bytes and distinguishable on the wire', () => {
    const a = AT_D890_PROBE.MARKER_ADDRESS;
    expect(makeAtD890ProbeSentinel(a)).toHaveLength(16);
    expect(makeAtD890ProbeMarker(a)).toHaveLength(16);
    expect(Array.from(makeAtD890ProbeMarker(a))).not.toEqual(
      Array.from(makeAtD890ProbeSentinel(a)),
    );
  });
});
