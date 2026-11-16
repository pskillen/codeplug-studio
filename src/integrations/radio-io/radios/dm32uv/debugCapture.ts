/**
 * Read-only DM-32UV debug session.
 *
 * The guard is the only path to the transport. It allows one exact session order:
 * `PSEARCH`, `PASSSTA`, `SYSINFO`, the 6-byte factory-sector frame twice, the V-frame
 * queries in `DM32_VFRAME_QUERY_IDS` order, `FF FF FF FF 0C PROGRAM`, `02`, `06`, then `52`
 * reads of 1, 2 or 4096 bytes inside the V-frame `0x0A` window. It keeps the session in
 * lock-step (no write while reply bytes are outstanding) and latches on any refusal, abort or
 * error: no later frame reaches the transport. There is no END on this radio; firmware leaves
 * PROGRAM after about 2 s of silence. Failure closes the transport, with no retry.
 */
import type { BytePipe, ProgressFn } from '../../types.ts';
import { throwIfAborted } from '../../kit/progress.ts';
import { RadioAbortedError, RadioProtocolError } from '../../kit/errors.ts';
import { parseVAddrRange } from '../../kit/codecs/vProbe.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_FACTORY_SECTOR_LENGTH,
  DM32_FACTORY_SECTOR_READ_FRAME,
  DM32_FACTORY_SECTOR_REPLY_OPCODE,
  DM32_METADATA,
  DM32_METADATA_OFFSET,
  DM32_VFRAME,
  DM32_VFRAME_QUERY_IDS,
} from './constants.ts';
import {
  dm32AsciiHandshake,
  dm32CaptureFactorySector,
  dm32EnterProgrammingMode,
  dm32QueryVFrame,
  type Dm32FactorySectorCapture,
} from './connection.ts';
import {
  alignConfigEnd,
  bulkReadDm32Blocks,
  discoverDm32MemoryBlocks,
  groupDm32BlocksForProgress,
  readChannelCount,
  selectBlocksToBulkRead,
  type Dm32ConfigWindow,
  type Dm32DiscoveredBlock,
} from './memory.ts';

/** Highest config-window end the guard accepts (V-frame `0x0A`). */
export const DM32_DEBUG_MAX_WINDOW_END = 0x0f_ffff;
/** Read lengths the product read path sends: metadata byte, channel count, full block. */
export const DM32_DEBUG_READ_LENGTHS: readonly number[] = [1, 2, DM32_BLOCK_SIZE];

const ASCII = (text: string) => new TextEncoder().encode(text);
const PROGRAM_FRAME = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x0c, ...ASCII('PROGRAM')]);

/** One expected reply chunk. `header` chunks are inspected; the next chunk length may follow. */
type ReplyChunk =
  | { kind: 'fixed'; length: number }
  | { kind: 'factory-header' }
  | { kind: 'factory-data' }
  | { kind: 'v-header'; id: number }
  | { kind: 'v-data'; id: number; length: number }
  | { kind: 'read-header'; address: number; length: number }
  | { kind: 'read-data'; length: number };

type Step =
  | { kind: 'ascii'; text: string; reply: number }
  | { kind: 'factory' }
  | { kind: 'v'; id: number }
  | { kind: 'program' }
  | { kind: 'mode02' }
  | { kind: 'ack06' };

const SESSION: readonly Step[] = [
  { kind: 'ascii', text: 'PSEARCH', reply: 8 },
  { kind: 'ascii', text: 'PASSSTA', reply: 3 },
  { kind: 'ascii', text: 'SYSINFO', reply: 1 },
  { kind: 'factory' },
  { kind: 'factory' },
  ...DM32_VFRAME_QUERY_IDS.map((id): Step => ({ kind: 'v', id })),
  { kind: 'program' },
  { kind: 'mode02' },
  { kind: 'ack06' },
];

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function hex(n: number): string {
  return `0x${n.toString(16)}`;
}

export interface Dm32DebugGuard {
  pipe: BytePipe;
  /** Block addresses `start` through `alignedEnd`, once the guard has parsed V `0x0A`. */
  window(): Dm32ConfigWindow | undefined;
  /** The first refusal or error that latched the guard. */
  failure(): unknown;
}

/** Wrap the transport so only the read-only session above can reach it. */
export function createDm32DebugGuard(pipe: BytePipe, signal?: AbortSignal): Dm32DebugGuard {
  let step = 0;
  let failed: unknown;
  let window: Dm32ConfigWindow | undefined;
  let reply: ReplyChunk[] = [];

  const latch = (error: unknown): never => {
    failed ??= error;
    throw error;
  };
  const refuse = (message: string): never =>
    latch(new RadioProtocolError(`DM-32 debug refused: ${message}`));
  const check = () => {
    if (signal?.aborted) latch(new RadioAbortedError());
    if (failed !== undefined) {
      throw new RadioProtocolError(
        `DM-32 debug session is no longer usable (${failed instanceof Error ? failed.message : 'failed'}).`,
      );
    }
  };

  /** Decide whether `data` is exactly the next allowed frame; return its expected reply. */
  const admit = (data: Uint8Array): ReplyChunk[] => {
    const next = SESSION[step];
    if (next) {
      switch (next.kind) {
        case 'ascii':
          if (sameBytes(data, ASCII(next.text))) return [{ kind: 'fixed', length: next.reply }];
          break;
        case 'factory':
          if (sameBytes(data, DM32_FACTORY_SECTOR_READ_FRAME)) return [{ kind: 'factory-header' }];
          break;
        case 'v':
          if (sameBytes(data, new Uint8Array([0x56, 0, 0, 0, next.id])))
            return [{ kind: 'v-header', id: next.id }];
          break;
        case 'program':
          if (!window) refuse('PROGRAM before the V-frame 0x0A window is known');
          if (sameBytes(data, PROGRAM_FRAME)) return [{ kind: 'fixed', length: 1 }];
          break;
        case 'mode02':
          if (sameBytes(data, new Uint8Array([0x02]))) return [{ kind: 'fixed', length: 8 }];
          break;
        case 'ack06':
          if (sameBytes(data, new Uint8Array([0x06]))) return [{ kind: 'fixed', length: 1 }];
          break;
      }
      return refuse(`frame 0x${data[0]?.toString(16) ?? '??'} (${data.length} bytes) out of order`);
    }
    if (data.length !== 6 || data[0] !== 0x52) return refuse('only 52 reads are allowed now');
    if (!window) return refuse('read before the window is known');
    const address = data[1]! | (data[2]! << 8) | (data[3]! << 16);
    const length = data[4]! | (data[5]! << 8);
    if (!DM32_DEBUG_READ_LENGTHS.includes(length)) return refuse(`read length ${length}`);
    const last = window.end + DM32_METADATA_OFFSET;
    if (address < window.start || address + length - 1 > last)
      return refuse(`read ${hex(address)}+${length} outside ${hex(window.start)}–${hex(last)}`);
    return [{ kind: 'read-header', address, length }];
  };

  /** Validate one reply chunk; may queue the chunk that follows it. */
  const accept = (chunk: ReplyChunk, bytes: Uint8Array) => {
    switch (chunk.kind) {
      case 'factory-header':
        if (
          bytes[0] !== DM32_FACTORY_SECTOR_REPLY_OPCODE ||
          !sameBytes(bytes.subarray(1), DM32_FACTORY_SECTOR_READ_FRAME.subarray(1))
        )
          refuse('factory-sector reply header');
        reply.push({ kind: 'factory-data' });
        return;
      case 'v-header': {
        if (bytes[0] !== 0x56) refuse(`V-frame reply opcode 0x${bytes[0]!.toString(16)}`);
        const length = bytes[2]!;
        if (length > 0) reply.push({ kind: 'v-data', id: bytes[1]!, length });
        return;
      }
      case 'v-data': {
        const asked = SESSION[step - 1];
        // Only a reply that names 0x0A, to the 0x0A query, sets the window.
        if (
          asked?.kind !== 'v' ||
          asked.id !== DM32_VFRAME.MEMORY_LAYOUT ||
          chunk.id !== DM32_VFRAME.MEMORY_LAYOUT
        )
          return;
        if (bytes.length !== 8) refuse('V-frame 0x0A is not 8 bytes');
        const range = parseVAddrRange(bytes);
        if (range.start > range.end) refuse('window start is after its end');
        if (range.end > DM32_DEBUG_MAX_WINDOW_END) refuse(`window end ${hex(range.end)}`);
        if (range.start % DM32_BLOCK_SIZE !== 0) refuse('window start is not block aligned');
        if (alignConfigEnd(range.end) < range.start) refuse('window has no block');
        window = { start: range.start, end: alignConfigEnd(range.end) };
        return;
      }
      case 'read-header': {
        const echo =
          bytes[0] === 0x57 &&
          bytes[1] === (chunk.address & 0xff) &&
          bytes[2] === ((chunk.address >>> 8) & 0xff) &&
          bytes[3] === ((chunk.address >>> 16) & 0xff);
        const length = bytes[4]! | (bytes[5]! << 8);
        if (!echo) refuse(`read reply header at ${hex(chunk.address)}`);
        // Exactly the requested length: a short reply would leave a partial block in the archive.
        if (length !== chunk.length)
          refuse(`read reply length ${length}, requested ${chunk.length}`);
        reply.push({ kind: 'read-data', length });
        return;
      }
      default:
        return;
    }
  };

  const chunkLength = (chunk: ReplyChunk): number => {
    switch (chunk.kind) {
      case 'fixed':
        return chunk.length;
      case 'factory-header':
      case 'read-header':
        return 6;
      case 'factory-data':
        return DM32_FACTORY_SECTOR_LENGTH;
      case 'v-header':
        return 3;
      case 'v-data':
      case 'read-data':
        return chunk.length;
    }
  };

  const safe: BytePipe = {
    async write(data) {
      check();
      if (reply.length > 0) refuse('write while a reply is outstanding');
      const expected = admit(data);
      if (step < SESSION.length) step += 1;
      reply = expected;
      try {
        await pipe.write(data.slice());
      } catch (error) {
        latch(error);
      }
    },
    async readExact(n, timeoutMs) {
      check();
      const chunk = reply[0];
      if (!chunk) refuse('read with no reply outstanding');
      if (n !== chunkLength(chunk!)) refuse(`read of ${n} bytes, expected ${chunkLength(chunk!)}`);
      let bytes: Uint8Array;
      try {
        bytes = await pipe.readExact(n, timeoutMs);
      } catch (error) {
        return latch(error);
      }
      check();
      if (bytes.length !== n) refuse('short radio reply');
      reply.shift();
      accept(chunk!, bytes);
      return bytes;
    },
    close: () => pipe.close(),
  };
  return { pipe: safe, window: () => (window ? { ...window } : undefined), failure: () => failed };
}

export type Dm32DebugVFrame =
  | { id: number; status: 'ok'; payload: Uint8Array }
  | { id: number; status: 'failed'; reason: string };

export interface Dm32DebugCapture {
  capturedAt: string;
  modelString: string;
  factory: Dm32FactorySectorCapture;
  vframes: Dm32DebugVFrame[];
  /** V-frame `0x0A` as returned. */
  rawRange: { start: number; end: number };
  window: Dm32ConfigWindow;
  /** Every block the metadata scan saw, with its tag. */
  discovered: Dm32DiscoveredBlock[];
  channelCount: number;
  /** Exactly the `selectBlocksToBulkRead` set: address → 4096 bytes. */
  blocks: Map<number, Uint8Array>;
}

/** Run the guarded read-only session. Closes the transport whatever happens. */
export async function captureDm32DebugPipe(
  pipe: BytePipe,
  opts?: { signal?: AbortSignal; onProgress?: ProgressFn; settleScale?: number },
): Promise<Dm32DebugCapture> {
  const guard = createDm32DebugGuard(pipe, opts?.signal);
  const settle = { signal: opts?.signal, settleScale: opts?.settleScale };
  const stopIfFailed = () => {
    throwIfAborted(opts?.signal);
    const failure = guard.failure();
    if (failure !== undefined) throw failure;
  };
  try {
    throwIfAborted(opts?.signal);
    opts?.onProgress?.({ cur: 0, max: 0, msg: 'Connecting…', stage: 'Connect' });
    const { modelString } = await dm32AsciiHandshake(guard.pipe, settle);
    // The helper keeps nothing on a failed copy; a framing or transport failure latches the guard.
    opts?.onProgress?.({
      cur: 0,
      max: 0,
      msg: 'Reading factory data and V-frames…',
      stage: 'Identity',
    });
    const factory = await dm32CaptureFactorySector(guard.pipe, settle);
    stopIfFailed();
    const vframes: Dm32DebugVFrame[] = [];
    for (const id of DM32_VFRAME_QUERY_IDS) {
      try {
        const reply = await dm32QueryVFrame(guard.pipe, id, settle);
        vframes.push({ id, status: 'ok', payload: reply.payload });
      } catch (error) {
        stopIfFailed();
        // A complete reply for another id: the session is still in lock-step.
        vframes.push({
          id,
          status: 'failed',
          reason: error instanceof Error ? error.message : 'failed',
        });
      }
    }
    const layout = vframes.find((v) => v.id === DM32_VFRAME.MEMORY_LAYOUT);
    const window = guard.window();
    if (layout?.status !== 'ok' || !window) {
      throw new RadioProtocolError('DM-32UV did not return its V-frame 0x0A memory window.');
    }
    const rawRange = parseVAddrRange(layout.payload);
    await dm32EnterProgrammingMode(guard.pipe, settle);
    const discovered = await discoverDm32MemoryBlocks(
      guard.pipe,
      window.start,
      window.end + DM32_METADATA_OFFSET,
      { ...settle, onProgress: opts?.onProgress },
    );
    const firstChannel = discovered.find((b) => b.metadata === DM32_METADATA.CHANNEL_FIRST);
    const channelCount = firstChannel
      ? await readChannelCount(guard.pipe, firstChannel.address, settle)
      : 0;
    const toRead = selectBlocksToBulkRead(discovered, channelCount, window);
    const blocks = new Map<number, Uint8Array>();
    for (const group of groupDm32BlocksForProgress(toRead)) {
      const part = await bulkReadDm32Blocks(guard.pipe, group.blocks, {
        ...settle,
        onProgress: opts?.onProgress,
        stage: group.stage,
      });
      for (const [address, data] of part) blocks.set(address, data);
    }
    stopIfFailed();
    opts?.onProgress?.({ cur: 0, max: 0, msg: 'Finishing…', stage: 'Finishing' });
    return {
      capturedAt: new Date().toISOString(),
      modelString,
      factory,
      vframes,
      rawRange,
      window,
      discovered,
      channelCount,
      blocks,
    };
  } finally {
    try {
      await pipe.close();
    } catch {
      /* Keep the original refusal, abort or error. */
    }
  }
}
