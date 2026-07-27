/**
 * AT-D890UV link and flash characterisation — read-only.
 *
 * Measured on hardware 2026-07-27, and none of it matches the obvious model:
 *
 * - **The serial line is not the bottleneck.** 240-byte blocks measured ~135 kB/s on the
 *   wire, which exceeds what 921600 8N1 allows. The port is USB CDC, so the baud setting is
 *   nominal and throughput is USB-limited.
 * - **Flash access is.** The same 16-byte read costs ~0.5 ms repeated at one address but
 *   ~5.8 ms when walking addresses `0x2000` apart — a page cache, with the miss paying a
 *   flash fetch.
 * - **Reads and writes are asymmetric.** Reads come straight from flash. Writes are staged
 *   into RAM and acknowledged immediately, with the flash erase/program cost — an order of
 *   magnitude slower than reading — deferred to a single radio-side commit after `END`.
 *
 * So a transfer is priced by *where the bytes come from*, not by baud, and an erase-unit
 * RMW must be costed as three separate terms. See {@link estimateAtD890RmwCost}.
 *
 * The wire length field is a `u8`; anytone-cps caps reads at 16 by its own choice, not
 * because the radio requires it. Nothing here writes to the radio.
 */

import { atD890ReadBlockRaw, atD890ReadMemory } from './connection.ts';
import { AT_D890_BLOCK_SIZE } from './constants.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import type { BytePipe, ProgressFn } from '../../types.ts';

/** Powers of two up to the `u8` ceiling, plus the largest 16-aligned value that fits. */
export const AT_D890_BLOCK_CANDIDATES = [0x10, 0x20, 0x40, 0x80, 0xf0] as const;

export interface AtD890BlockTrial {
  blockSize: number;
  ok: boolean;
  /** Why a trial failed — timeout, checksum, or bytes not matching the baseline. */
  detail?: string;
  msPerFrame?: number;
  payloadBytesPerSecond?: number;
}

export interface AtD890LinkProfile {
  baselineMsPerFrame: number;
  baselinePayloadBytesPerSecond: number;
  trials: AtD890BlockTrial[];
  /** Largest block size that returned bytes identical to the 16-byte baseline. */
  bestBlockSize: number;
  /** Throughput multiplier of `bestBlockSize` over 16-byte frames. */
  speedup: number;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/**
 * Time `iterations` single-block reads and return ms per frame.
 * Reads the same address repeatedly — this measures the link, not the flash.
 */
async function timeReads(
  pipe: BytePipe,
  address: number,
  blockSize: number,
  iterations: number,
  signal?: AbortSignal,
): Promise<number> {
  const started = performance.now();
  for (let i = 0; i < iterations; i++) {
    throwIfAborted(signal);
    await atD890ReadBlockRaw(pipe, address, blockSize, signal);
  }
  return (performance.now() - started) / iterations;
}

export interface AtD890ReadBlockNegotiation {
  trials: AtD890BlockTrial[];
  /** Largest block size that returned bytes identical to the 16-byte baseline. */
  bestBlockSize: number;
}

/**
 * Probe which read block sizes the radio honours — no timing loops.
 * Used on Connect and as the first phase of {@link profileAtD890Link}.
 */
export async function probeAtD890ReadBlockSizes(
  pipe: BytePipe,
  address: number,
  opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {},
): Promise<AtD890ReadBlockNegotiation> {
  const maxCandidate = Math.max(...AT_D890_BLOCK_CANDIDATES);
  const baselineSpan = Math.ceil(maxCandidate / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE;
  const baseline = await atD890ReadMemory(
    pipe,
    address,
    baselineSpan,
    opts.signal,
    AT_D890_BLOCK_SIZE,
  );

  const trials: AtD890BlockTrial[] = [];
  for (let i = 0; i < AT_D890_BLOCK_CANDIDATES.length; i++) {
    throwIfAborted(opts.signal);
    const blockSize = AT_D890_BLOCK_CANDIDATES[i]!;
    reportProgress(
      opts.onProgress,
      {
        cur: i + 1,
        max: AT_D890_BLOCK_CANDIDATES.length,
        msg: `Trying ${blockSize}-byte blocks`,
        stage: 'Link probe',
      },
      opts.signal,
    );
    try {
      const got = await atD890ReadBlockRaw(pipe, address, blockSize, opts.signal);
      if (!sameBytes(got, baseline.subarray(0, blockSize))) {
        trials.push({
          blockSize,
          ok: false,
          detail: 'reply did not match the 16-byte baseline for the same address',
        });
        continue;
      }
      trials.push({ blockSize, ok: true });
    } catch (e) {
      trials.push({
        blockSize,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
      await pipe.flush?.();
    }
  }

  const okTrials = trials.filter((t) => t.ok);
  const bestBlockSize =
    okTrials.length > 0 ? Math.max(...okTrials.map((t) => t.blockSize)) : AT_D890_BLOCK_SIZE;

  return { trials, bestBlockSize };
}

/**
 * Connect-fast negotiator — finds the largest usable read block without timing loops.
 */
export async function negotiateAtD890ReadBlockSize(
  pipe: BytePipe,
  address: number,
  opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {},
): Promise<AtD890ReadBlockNegotiation> {
  return probeAtD890ReadBlockSizes(pipe, address, opts);
}

/**
 * Probe the link for the largest usable block size. Read-only; caller supplies a connected,
 * PROGRAM-mode pipe and an address whose contents are stable across the probe.
 */
export async function profileAtD890Link(
  pipe: BytePipe,
  address: number,
  opts: { onProgress?: ProgressFn; signal?: AbortSignal; iterations?: number } = {},
): Promise<AtD890LinkProfile> {
  const iterations = opts.iterations ?? 8;
  const { trials: probeTrials, bestBlockSize } = await probeAtD890ReadBlockSizes(
    pipe,
    address,
    opts,
  );

  const baselineMsPerFrame = await timeReads(
    pipe,
    address,
    AT_D890_BLOCK_SIZE,
    iterations,
    opts.signal,
  );

  const trials: AtD890BlockTrial[] = [];
  for (const probeTrial of probeTrials) {
    if (!probeTrial.ok) {
      trials.push(probeTrial);
      continue;
    }
    const msPerFrame = await timeReads(
      pipe,
      address,
      probeTrial.blockSize,
      iterations,
      opts.signal,
    );
    trials.push({
      blockSize: probeTrial.blockSize,
      ok: true,
      msPerFrame,
      payloadBytesPerSecond: (probeTrial.blockSize * 1000) / msPerFrame,
    });
  }

  const okTrials = trials.filter((t) => t.ok);
  const best = okTrials.find((t) => t.blockSize === bestBlockSize);
  const baselineRate = (AT_D890_BLOCK_SIZE * 1000) / baselineMsPerFrame;

  return {
    baselineMsPerFrame,
    baselinePayloadBytesPerSecond: baselineRate,
    trials,
    bestBlockSize,
    speedup: best?.payloadBytesPerSecond ? best.payloadBytesPerSecond / baselineRate : 1,
  };
}

export interface AtD890StrideSample {
  stride: number;
  msPerFrame: number;
}

export interface AtD890AccessProfile {
  samples: AtD890StrideSample[];
  /** Fastest observed — a read served from the radio's page cache. */
  cachedMsPerFrame: number;
  /** Slowest observed — every read missing the cache and fetching flash. */
  missMsPerFrame: number;
  /**
   * Smallest stride at which latency saturates: reads this far apart always miss, so the
   * radio's read page is no larger than this.
   *
   * With block size held constant, latency grows roughly linearly with stride until the
   * stride reaches the page size (`hit + (miss - hit) * min(stride/page, 1)`), then flattens.
   */
  inferredPageBytes: number | null;
}

/**
 * Time reads at increasing stride to expose the radio's read page. Read-only.
 *
 * Block size is fixed at 16 so the only variable is locality; `profileAtD890Link` covers
 * the orthogonal block-size question.
 */
export async function profileAtD890AccessPattern(
  pipe: BytePipe,
  baseAddress: number,
  opts: { onProgress?: ProgressFn; signal?: AbortSignal; iterations?: number } = {},
): Promise<AtD890AccessProfile> {
  const iterations = opts.iterations ?? 12;
  const strides = [0x10, 0x40, 0x100, 0x400, 0x800, 0x1000, 0x2000, 0x4000];
  const samples: AtD890StrideSample[] = [];

  for (let i = 0; i < strides.length; i++) {
    throwIfAborted(opts.signal);
    const stride = strides[i]!;
    reportProgress(
      opts.onProgress,
      {
        cur: i + 1,
        max: strides.length,
        msg: `Reading at ${stride}-byte stride`,
        stage: 'Access pattern',
      },
      opts.signal,
    );
    const started = performance.now();
    for (let n = 0; n < iterations; n++) {
      await atD890ReadBlockRaw(pipe, baseAddress + n * stride, AT_D890_BLOCK_SIZE, opts.signal);
    }
    samples.push({ stride, msPerFrame: (performance.now() - started) / iterations });
  }

  const latencies = samples.map((s) => s.msPerFrame);
  const cachedMsPerFrame = Math.min(...latencies);
  const missMsPerFrame = Math.max(...latencies);
  // Saturation point: first stride within 5% of the slowest reading.
  const saturated = samples.find((s) => s.msPerFrame >= missMsPerFrame * 0.95);

  /*
   * Only claim a page size when the curve shows a real cache effect. Both tests matter:
   * the ratio alone would read scheduler noise as signal when every read is sub-millisecond,
   * so also require an absolute gap — fetching a flash page costs milliseconds, not
   * microseconds.
   */
  const spread = missMsPerFrame / Math.max(cachedMsPerFrame, 0.001);
  const gapMs = missMsPerFrame - cachedMsPerFrame;
  const hasCacheSignal = spread >= 2 && gapMs >= 1;

  return {
    samples,
    cachedMsPerFrame,
    missMsPerFrame,
    inferredPageBytes: hasCacheSignal && saturated ? saturated.stride : null,
  };
}

export interface AtD890SweepResult {
  bytes: number;
  blockSize: number;
  seconds: number;
  bytesPerSecond: number;
}

/**
 * Time a contiguous forward sweep — the access pattern an erase-unit RMW actually uses,
 * and therefore the only honest basis for costing it. Read-only.
 */
export async function benchmarkAtD890Sweep(
  pipe: BytePipe,
  baseAddress: number,
  bytes: number,
  blockSize: number,
  opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {},
): Promise<AtD890SweepResult> {
  const frames = Math.ceil(bytes / blockSize);
  const started = performance.now();
  for (let i = 0; i < frames; i++) {
    throwIfAborted(opts.signal);
    if (i % 32 === 0) {
      reportProgress(
        opts.onProgress,
        { cur: i, max: frames, msg: `Sweeping ${blockSize}-byte blocks`, stage: 'Sweep' },
        opts.signal,
      );
    }
    await atD890ReadBlockRaw(pipe, baseAddress + i * blockSize, blockSize, opts.signal);
  }
  const seconds = (performance.now() - started) / 1000;
  return {
    bytes: frames * blockSize,
    blockSize,
    seconds,
    bytesPerSecond: (frames * blockSize) / seconds,
  };
}

export interface AtD890RmwCostInputs {
  unitBytes: number;
  touchedUnits: number;
  /** Measured contiguous-sweep rate. Reads are served from flash and pay its latency. */
  readBytesPerSecond: number;
  /** Measured write-frame rate. Staging only reaches RAM, so it does not pay flash cost. */
  stageBytesPerSecond: number;
  /**
   * Radio-side flash erase + program, paid once on commit after `END`.
   * Operator-observed on this radio: ~10-20 s for a full CPS write.
   */
  commitSeconds: number;
}

export interface AtD890RmwCost {
  readSeconds: number;
  stageSeconds: number;
  commitSeconds: number;
  totalSeconds: number;
}

/**
 * Cost of a full erase-unit read-modify-write, modelled in three parts.
 *
 * Reads and writes are **not** symmetric on this radio, so pricing both at one rate is
 * wrong in both directions:
 *
 * - **Reads** come straight from flash and pay its access latency (and its page-miss
 *   penalty on a sweep) — this is the slow half over the wire.
 * - **Writes** are staged into RAM by the radio and acknowledged immediately, so the wire
 *   cost is transport only. Flash program/erase — which is an order of magnitude slower
 *   than reading — is *not* paid per frame.
 * - **Commit** pays all of that flash cost at once, after `END`, as a single radio-side
 *   operation the host just waits on.
 *
 * `commitSeconds` is supplied rather than derived: it is a property of how much the radio
 * decides to erase and program, which the host cannot see. Treat it as roughly fixed per
 * Write, and revise it upward if the number of touched units grows a lot.
 */
export function estimateAtD890RmwCost({
  unitBytes,
  touchedUnits,
  readBytesPerSecond,
  stageBytesPerSecond,
  commitSeconds,
}: AtD890RmwCostInputs): AtD890RmwCost {
  const bytes = unitBytes * touchedUnits;
  const readSeconds =
    readBytesPerSecond > 0 ? bytes / readBytesPerSecond : Number.POSITIVE_INFINITY;
  const stageSeconds =
    stageBytesPerSecond > 0 ? bytes / stageBytesPerSecond : Number.POSITIVE_INFINITY;
  return {
    readSeconds,
    stageSeconds,
    commitSeconds,
    totalSeconds: readSeconds + stageSeconds + commitSeconds,
  };
}
