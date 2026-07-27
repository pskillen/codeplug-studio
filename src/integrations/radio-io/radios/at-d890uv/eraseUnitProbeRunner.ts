/**
 * Session orchestration for the AT-D890UV erase-unit probe (#768 phase 1).
 *
 * Three passes, each its own PROGRAM session, with a radio power-cycle between them —
 * the radio stages writes in RAM and applies them on commit, so a same-session read-back
 * returns the shadow rather than flash and would report nothing.
 *
 *   1. {@link runAtD890ProbePaint}          write the sentinel grid, commit
 *   2. {@link runAtD890ProbeVerifyAndMark}  confirm the grid survived, write one marker, commit
 *   3. {@link runAtD890ProbeMeasure}        read the grid back; erased run == one erase unit
 *
 * Pass 2's verification doubles as the control for "writes to one unit in a single session
 * coexist" — the assumption the whole erase-unit RMW fix rests on.
 */

import {
  atD890EnterProgram,
  atD890ExitProgram,
  atD890ProbeIdent,
  atD890ReadMemory,
  atD890WriteBlockRaw,
  atD890WriteMemory,
} from './connection.ts';
import {
  AT_D890_PROBE,
  analyseAtD890EraseUnit,
  assertAtD890ProbeSpanUnused,
  classifyAtD890Sentinel,
  inferAtD890Aliasing,
  listAtD890ProbeSentinels,
  makeAtD890ProbeMarker,
  readAtD890ProbeTag,
  summariseAtD890Throughput,
  verifyAtD890Paint,
  type AtD890AliasVerdict,
  type AtD890EraseUnitResult,
  type AtD890PaintVerdict,
  type AtD890SentinelReading,
  type AtD890ThroughputResult,
} from './eraseUnitProbe.ts';
import {
  benchmarkAtD890Sweep,
  profileAtD890AccessPattern,
  profileAtD890Link,
  type AtD890AccessProfile,
  type AtD890LinkProfile,
  type AtD890SweepResult,
} from './linkProbe.ts';
import {
  buildAtD890WriteTrials,
  classifyAtD890WriteReadback,
  summariseAtD890WriteProbe,
  type AtD890WriteProbeVerdict,
  type AtD890WriteTrialResult,
} from './writeBlockProbe.ts';
import { AT_D890_BLOCK_SIZE, AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import type { BytePipe, ProgressFn } from '../../types.ts';

export interface AtD890ProbeOpts {
  onProgress?: ProgressFn;
  signal?: AbortSignal;
}

/** `atD890ProbeIdent` rejects any non-`ID890UV` radio, so no extra model guard is needed. */
async function enterProgramAndIdent(pipe: BytePipe, signal?: AbortSignal): Promise<string> {
  await atD890EnterProgram(pipe, signal);
  const ident = await atD890ProbeIdent(pipe, signal);
  return ident.model;
}

/** Commit staged writes. The operator must power-cycle before the next pass. */
async function commit(pipe: BytePipe): Promise<void> {
  await atD890ExitProgram(pipe);
}

async function readSentinels(
  pipe: BytePipe,
  opts: AtD890ProbeOpts,
  stage: string,
): Promise<{ readings: AtD890SentinelReading[]; throughput: AtD890ThroughputResult }> {
  const sentinels = listAtD890ProbeSentinels();
  const readings: AtD890SentinelReading[] = [];
  const started = Date.now();
  for (let i = 0; i < sentinels.length; i++) {
    throwIfAborted(opts.signal);
    const { address } = sentinels[i]!;
    reportProgress(
      opts.onProgress,
      { cur: i + 1, max: sentinels.length, msg: `Reading 0x${address.toString(16)}`, stage },
      opts.signal,
    );
    const data = await atD890ReadMemory(pipe, address, AT_D890_BLOCK_SIZE, opts.signal);
    const tag = readAtD890ProbeTag(data);
    readings.push({
      address,
      state: classifyAtD890Sentinel(address, data),
      ...(tag == null ? {} : { tag }),
    });
  }
  return {
    readings,
    throughput: summariseAtD890Throughput({
      frames: sentinels.length,
      elapsedMs: Date.now() - started,
    }),
  };
}

export interface AtD890ProbeInspectResult {
  model: string;
  /** Channel slots inside the probe span that are marked occupied — must be empty to proceed. */
  occupiedSlots: number[];
  /** Sampled cells holding anything other than erased flash. */
  nonEmptyCells: number[];
  totalCells: number;
  readThroughput: AtD890ThroughputResult;
}

/**
 * Pass 0 — read-only reconnaissance. Writes nothing.
 *
 * Confirms the probe span holds no channel records and no live data before pass 1 puts
 * anything on the flash, so the operator can see the blast radius is empty first.
 */
export async function runAtD890ProbeInspect(
  pipe: BytePipe,
  opts: AtD890ProbeOpts = {},
): Promise<AtD890ProbeInspectResult> {
  const model = await enterProgramAndIdent(pipe, opts.signal);

  const channelSet = await atD890ReadMemory(
    pipe,
    D890_MAP.ChannelSet,
    AT_D890_LIMITS.CHANNEL_SET_BYTES,
    opts.signal,
  );
  const occupiedSlots: number[] = [];
  for (
    let slot = AT_D890_PROBE.FIRST_CHANNEL_SLOT;
    slot <= AT_D890_PROBE.LAST_CHANNEL_SLOT;
    slot++
  ) {
    const byte = channelSet[slot >> 3];
    if (byte != null && (byte & (1 << (slot % 8))) !== 0) occupiedSlots.push(slot);
  }

  const sentinels = listAtD890ProbeSentinels();
  const nonEmptyCells: number[] = [];
  const started = Date.now();
  for (let i = 0; i < sentinels.length; i++) {
    throwIfAborted(opts.signal);
    const { address } = sentinels[i]!;
    reportProgress(
      opts.onProgress,
      {
        cur: i + 1,
        max: sentinels.length,
        msg: `Inspecting 0x${address.toString(16)}`,
        stage: 'Inspect',
      },
      opts.signal,
    );
    const data = await atD890ReadMemory(pipe, address, AT_D890_BLOCK_SIZE, opts.signal);
    if (!data.every((byte) => byte === 0xff)) nonEmptyCells.push(address);
  }
  const readThroughput = summariseAtD890Throughput({
    frames: sentinels.length,
    elapsedMs: Date.now() - started,
  });

  await commit(pipe);
  return {
    model,
    occupiedSlots,
    nonEmptyCells,
    totalCells: sentinels.length,
    readThroughput,
  };
}

export interface AtD890ProbePaintResult {
  model: string;
  sentinelsWritten: number;
  throughput: AtD890ThroughputResult;
}

/**
 * Pass 1 — paint the sentinel grid.
 *
 * Refuses unless every channel slot inside the probe span is vacant, so the probe can
 * never overwrite a real channel record.
 */
export async function runAtD890ProbePaint(
  pipe: BytePipe,
  opts: AtD890ProbeOpts = {},
): Promise<AtD890ProbePaintResult> {
  const model = await enterProgramAndIdent(pipe, opts.signal);

  reportProgress(
    opts.onProgress,
    { cur: 0, max: 1, msg: 'Checking the probe span is unused…', stage: 'Safety check' },
    opts.signal,
  );
  const channelSet = await atD890ReadMemory(
    pipe,
    D890_MAP.ChannelSet,
    AT_D890_LIMITS.CHANNEL_SET_BYTES,
    opts.signal,
  );
  assertAtD890ProbeSpanUnused(channelSet);

  const sentinels = listAtD890ProbeSentinels();
  const started = Date.now();
  for (let i = 0; i < sentinels.length; i++) {
    throwIfAborted(opts.signal);
    const { address, data } = sentinels[i]!;
    reportProgress(
      opts.onProgress,
      {
        cur: i + 1,
        max: sentinels.length,
        msg: `Painting 0x${address.toString(16)}`,
        stage: 'Paint',
      },
      opts.signal,
    );
    await atD890WriteMemory(pipe, address, data, opts.signal);
  }
  const throughput = summariseAtD890Throughput({
    frames: sentinels.length,
    elapsedMs: Date.now() - started,
  });

  await commit(pipe);
  return { model, sentinelsWritten: sentinels.length, throughput };
}

export interface AtD890ProbeDiagnoseResult {
  paint: AtD890PaintVerdict;
  alias: AtD890AliasVerdict;
  readings: AtD890SentinelReading[];
  readThroughput: AtD890ThroughputResult;
}

/**
 * Read-only forensics on an already-painted grid. Writes nothing.
 *
 * Run this when pass 2 reports the grid did not survive. Because every probe block carries
 * the address it was written to, reading the grid back shows whether cells were erased
 * (contents gone) or aliased (contents present, but written via a different address).
 */
export async function runAtD890ProbeDiagnose(
  pipe: BytePipe,
  opts: AtD890ProbeOpts = {},
): Promise<AtD890ProbeDiagnoseResult> {
  await enterProgramAndIdent(pipe, opts.signal);
  const { readings, throughput } = await readSentinels(pipe, opts, 'Diagnose');
  await commit(pipe);
  return {
    paint: verifyAtD890Paint(readings),
    alias: inferAtD890Aliasing(readings),
    readings,
    readThroughput: throughput,
  };
}

export interface AtD890ProbeMarkResult {
  /** False when the grid did not survive; the marker is then deliberately not written. */
  ok: boolean;
  paint: AtD890PaintVerdict;
  alias: AtD890AliasVerdict;
  readings: AtD890SentinelReading[];
  markerWritten: boolean;
  markerAddress: number;
  readThroughput: AtD890ThroughputResult;
}

/**
 * Pass 2 — verify the painted grid survived, then write a single marker inside it.
 *
 * Returns `ok: false` **without writing the marker** when the grid did not survive, rather
 * than throwing: the per-cell readings are the diagnosis and must not be discarded. The
 * marker is only ever written on a clean grid.
 */
export async function runAtD890ProbeVerifyAndMark(
  pipe: BytePipe,
  opts: AtD890ProbeOpts = {},
): Promise<AtD890ProbeMarkResult> {
  await enterProgramAndIdent(pipe, opts.signal);

  const { readings, throughput } = await readSentinels(pipe, opts, 'Verify paint');
  const paint = verifyAtD890Paint(readings);
  const alias = inferAtD890Aliasing(readings);
  if (!paint.ok) {
    await commit(pipe);
    return {
      ok: false,
      paint,
      alias,
      readings,
      markerWritten: false,
      markerAddress: AT_D890_PROBE.MARKER_ADDRESS,
      readThroughput: throughput,
    };
  }

  reportProgress(
    opts.onProgress,
    {
      cur: 1,
      max: 1,
      msg: `Writing marker at 0x${AT_D890_PROBE.MARKER_ADDRESS.toString(16)}`,
      stage: 'Mark',
    },
    opts.signal,
  );
  await atD890WriteMemory(
    pipe,
    AT_D890_PROBE.MARKER_ADDRESS,
    makeAtD890ProbeMarker(AT_D890_PROBE.MARKER_ADDRESS),
    opts.signal,
  );

  await commit(pipe);
  return {
    ok: true,
    paint,
    alias,
    readings,
    markerWritten: true,
    markerAddress: AT_D890_PROBE.MARKER_ADDRESS,
    readThroughput: throughput,
  };
}

export interface AtD890ProbeMeasureResult {
  result: AtD890EraseUnitResult;
  readings: AtD890SentinelReading[];
  readThroughput: AtD890ThroughputResult;
}

export interface AtD890LinkProbeResult {
  model: string;
  profile: AtD890LinkProfile;
  access: AtD890AccessProfile;
  /** Contiguous sweep at the best block size — the pattern an erase-unit RMW actually uses. */
  sweep: AtD890SweepResult;
}

/**
 * Read-only link characterisation. Writes nothing.
 *
 * Probes at the first probe-span address, whose contents are stable and unimportant.
 */
export async function runAtD890LinkProbe(
  pipe: BytePipe,
  opts: AtD890ProbeOpts = {},
): Promise<AtD890LinkProbeResult> {
  const model = await enterProgramAndIdent(pipe, opts.signal);
  const profile = await profileAtD890Link(pipe, AT_D890_PROBE.SPAN_START, opts);
  const access = await profileAtD890AccessPattern(pipe, AT_D890_PROBE.SPAN_START, opts);
  // 64 kB is enough to cross many pages, so the rate reflects steady state rather than cache.
  const sweep = await benchmarkAtD890Sweep(
    pipe,
    AT_D890_PROBE.SPAN_START,
    0x10000,
    profile.bestBlockSize,
    opts,
  );
  await commit(pipe);
  return { model, profile, access, sweep };
}

export interface AtD890WriteProbeResult {
  model: string;
  verdict: AtD890WriteProbeVerdict;
  /**
   * The radio stopped answering after a write — its parser consumed part of the frame as
   * commands. Nothing is committed in this case and the operator must power-cycle.
   */
  desynced: boolean;
  /** False when the session was abandoned without `END`, so nothing reached flash. */
  committed: boolean;
  /**
   * Whether a read issued in the same session as a write returned the newly written bytes.
   * `true` means reads see the staged shadow; `false` means they come from flash and any
   * same-session Write verification is meaningless (#769).
   */
  inSessionReadsSeeStagedWrites: boolean;
}

/**
 * Write-side pass 1 — try each candidate block size, then re-read in the same session.
 *
 * Trials run ascending and **stop at the first refusal**, so a radio that rejected one size
 * is never handed a larger frame. Every payload lands in the probe span's last block, which
 * pass 0 has already confirmed holds no channel records.
 */
export async function runAtD890WriteBlockProbe(
  pipe: BytePipe,
  opts: AtD890ProbeOpts = {},
): Promise<AtD890WriteProbeResult> {
  const model = await enterProgramAndIdent(pipe, opts.signal);

  const trials = buildAtD890WriteTrials();
  const results: AtD890WriteTrialResult[] = [];
  let desynced = false;

  for (let i = 0; i < trials.length; i++) {
    throwIfAborted(opts.signal);
    const { blockSize, address, payload } = trials[i]!;
    reportProgress(
      opts.onProgress,
      {
        cur: i + 1,
        max: trials.length,
        msg: `Writing ${blockSize} bytes at 0x${address.toString(16)}`,
        stage: 'Write probe',
      },
      opts.signal,
    );
    try {
      await atD890WriteBlockRaw(pipe, address, payload, opts.signal);
    } catch (e) {
      results.push({
        blockSize,
        address,
        accepted: false,
        detail: e instanceof Error ? e.message : String(e),
      });
      await pipe.flush?.();
      break;
    }

    /*
     * Read back immediately, before trying anything larger. An oversized frame does not
     * merely fail — it desyncs the radio, because the tail of the frame re-enters its
     * command parser. A read that times out here is that desync, and once the stream is
     * broken every later trial is meaningless, so stop at once.
     *
     * This read also answers whether an in-session read sees the staged shadow or flash.
     */
    try {
      const data = await atD890ReadMemory(pipe, address, blockSize, opts.signal);
      const { outcome, matchingPrefix } = classifyAtD890WriteReadback(address, blockSize, data);
      results.push({ blockSize, address, accepted: true, readback: outcome, matchingPrefix });
    } catch (e) {
      results.push({
        blockSize,
        address,
        accepted: true,
        detail: `desynced after this size: ${e instanceof Error ? e.message : String(e)}`,
      });
      desynced = true;
      await pipe.flush?.();
      break;
    }
  }

  /*
   * Commit only a clean run. A desynced radio may have parsed part of our payload as
   * commands, so whatever is staged is not what we intended — sending END would make that
   * permanent. Leaving without END discards the shadow on power-cycle.
   */
  if (!desynced) await commit(pipe);

  const sixteen = results.find((r) => r.blockSize === AT_D890_BLOCK_SIZE);
  return {
    model,
    verdict: summariseAtD890WriteProbe(results),
    desynced,
    committed: !desynced,
    // The 16-byte case is the control: it is known to work, so if even that does not read
    // back in-session, reads are coming from flash rather than the staged shadow.
    inSessionReadsSeeStagedWrites: sixteen?.readback === 'match',
  };
}

/**
 * Write-side pass 2 — after `END` and a power-cycle, re-read the trial addresses.
 *
 * Only this proves a block size committed correctly; the same-session read in pass 1 may
 * have been served from the staged shadow. Read-only.
 */
export async function runAtD890WriteBlockVerify(
  pipe: BytePipe,
  opts: AtD890ProbeOpts = {},
): Promise<{ model: string; verdict: AtD890WriteProbeVerdict }> {
  const model = await enterProgramAndIdent(pipe, opts.signal);

  const trials = buildAtD890WriteTrials();
  const results: AtD890WriteTrialResult[] = [];
  for (let i = 0; i < trials.length; i++) {
    throwIfAborted(opts.signal);
    const { blockSize, address } = trials[i]!;
    reportProgress(
      opts.onProgress,
      {
        cur: i + 1,
        max: trials.length,
        msg: `Verifying ${blockSize} bytes at 0x${address.toString(16)}`,
        stage: 'Write verify',
      },
      opts.signal,
    );
    const data = await atD890ReadMemory(pipe, address, blockSize, opts.signal);
    const { outcome, matchingPrefix } = classifyAtD890WriteReadback(address, blockSize, data);
    results.push({ blockSize, address, accepted: true, readback: outcome, matchingPrefix });
  }

  await commit(pipe);
  return { model, verdict: summariseAtD890WriteProbe(results) };
}

/** Pass 3 — read the grid back and derive the erase unit from the erased run. */
export async function runAtD890ProbeMeasure(
  pipe: BytePipe,
  opts: AtD890ProbeOpts = {},
): Promise<AtD890ProbeMeasureResult> {
  await enterProgramAndIdent(pipe, opts.signal);
  const { readings, throughput } = await readSentinels(pipe, opts, 'Measure');
  await commit(pipe);
  return { result: analyseAtD890EraseUnit(readings), readings, readThroughput: throughput };
}
