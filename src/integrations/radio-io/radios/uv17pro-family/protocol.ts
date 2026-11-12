/**
 * UV-17Pro family CloneImageRadio — PROGRAM+R/W handshake, multi-region download/upload.
 */

import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  expectAck,
  makeProgramRwReadFrame,
  makeProgramRwWriteFrame,
  parseProgramRwReadReply,
  sendIdent,
} from '../../kit/codecs/programRw.ts';
import { createMemoryMap, memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { RadioProtocolError, RadioTimeoutError, RadioWrongIdentError } from '../../kit/errors.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import type { WriteVerifyStagingSnapshot } from '../../writeVerify.ts';
import { captureWriteVerifyStaging } from '../../writeVerifyCompare.ts';
import type { Uv17ProLayout, Uv17ProWriteContext } from './layout.ts';
import { uv17ProBackupMemSpans } from './backupRestoreRoles.ts';
import { uv17ProCrypt } from './crypt.ts';
import {
  intendedUv17ProRestoreImage,
  listUv17ProRestoreWriteAddresses,
} from './restoreFromBackup.ts';
import {
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
  readFirmwareFromImage,
} from './channelCodec.ts';

type HandshakeMode = 'read' | 'upload';

/** Frames a modified-firmware target writes after the clone blocks, under their own progress stage. */
export interface Uv17ProExtraUploadFrames {
  /** Progress stage label; the descriptor's plan names it too. */
  stage: string;
  /** In write order. Each is one `blockSize` frame at a radio address outside the clone. */
  frames: readonly { address: number; bytes: Uint8Array }[];
}

export interface Uv17ProConnectOptions {
  signal?: AbortSignal;
  settleScale?: number;
  handshake?: 'read' | 'none';
}

type HandshakeOpts = Uv17ProConnectOptions;

function scaledMs(baseMs: number, scale: number): number {
  if (scale <= 0) return 0;
  return Math.round(baseMs * scale);
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      reject(signal?.reason ?? new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
  throwIfAborted(signal);
}

async function flushPipe(pipe: BytePipe): Promise<void> {
  if (pipe.flush) {
    await pipe.flush();
  }
}

export function packedOffsetForRadioAddr(layout: Uv17ProLayout, radioAddr: number): number {
  let packed = 0;
  for (let i = 0; i < layout.memStarts.length; i++) {
    const start = layout.memStarts[i]!;
    const size = layout.memSizes[i]!;
    if (radioAddr >= start && radioAddr < start + size) {
      return packed + (radioAddr - start);
    }
    packed += size;
  }
  throw new RangeError(`Radio address 0x${radioAddr.toString(16)} not in MEM_* regions`);
}

function listRadioBlockAddresses(layout: Uv17ProLayout): number[] {
  const addrs: number[] = [];
  for (let i = 0; i < layout.memStarts.length; i++) {
    const start = layout.memStarts[i]!;
    const size = layout.memSizes[i]!;
    for (let off = 0; off < size; off += layout.blockSize) {
      addrs.push(start + off);
    }
  }
  return addrs;
}

async function waitForReadResponse(
  pipe: BytePipe,
  readResponseLen: number,
  timeoutMs: number,
): Promise<Uint8Array> {
  const deadline = Date.now() + timeoutMs;
  const pending: number[] = [];
  while (Date.now() < deadline) {
    while (pending.length > 0 && pending[0] !== 0x52) {
      pending.shift();
    }
    if (pending.length >= readResponseLen) {
      return new Uint8Array(pending.splice(0, readResponseLen));
    }
    const remaining = Math.max(1, deadline - Date.now());
    const byte = await pipe.readExact(1, remaining);
    pending.push(byte[0]!);
  }
  throw new RadioTimeoutError(
    `Timeout waiting for read response (${readResponseLen} bytes). Have ${pending.length} bytes.`,
  );
}

const MODEL_MAGIC = 0x4d;

async function runMagics(
  layout: Uv17ProLayout,
  pipe: BytePipe,
  mode: HandshakeMode,
  signal?: AbortSignal,
): Promise<void> {
  const magics = mode === 'read' ? layout.magics.read : layout.magics.upload;
  for (const { send, responseLen } of magics) {
    throwIfAborted(signal);
    await flushPipe(pipe);
    await pipe.write(send);
    const reply = await pipe.readExact(responseLen, layout.ioTimeoutMs);
    if (send.length === 1 && send[0] === MODEL_MAGIC) {
      assertModelReply(layout, reply);
    }
  }
}

/** The `M` magic's reply names the model. Refuse a mismatch before any write frame. */
function assertModelReply(layout: Uv17ProLayout, reply: Uint8Array): void {
  const prefix = layout.modelReplyPrefix;
  if (!prefix) return;
  if (prefix.length > reply.length || !prefix.every((b, i) => reply[i] === b)) {
    throw new RadioWrongIdentError(
      `This radio doesn't answer as a ${layout.protocolLabel}. Nothing was written.`,
    );
  }
}

async function handshake(
  layout: Uv17ProLayout,
  pipe: BytePipe,
  mode: HandshakeMode,
  opts?: HandshakeOpts,
): Promise<void> {
  const signal = opts?.signal;
  const skipPortSettle = mode === 'upload';
  const scale = skipPortSettle ? 0 : (opts?.settleScale ?? 1);
  throwIfAborted(signal);
  if (!skipPortSettle) {
    await delay(scaledMs(layout.initDelayMs, scale), signal);
  }
  await flushPipe(pipe);
  if (!skipPortSettle) {
    await delay(scaledMs(layout.clearBufferDelayMs, scale), signal);
  }
  try {
    await sendIdent(pipe, layout.ident, layout.identTimeoutMs);
  } catch (err) {
    throw new RadioWrongIdentError(
      err instanceof Error
        ? `${layout.protocolLabel} ident failed: ${err.message}`
        : `${layout.protocolLabel} ident failed`,
    );
  }
  await runMagics(layout, pipe, mode, signal);
}

export class Uv17ProProtocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;
  private lastUploadStaging: WriteVerifyStagingSnapshot | undefined;
  /** Live packed image from the most recent {@link download} in this session. */
  private priorImage: MemoryMap | null = null;
  /** True after ident + read magics this session. Upload then skips a second handshake. */
  private identComplete = false;

  constructor(private readonly layout: Uv17ProLayout) {}

  /** Packed clone from the last in-session download — used as the Write encode base. */
  getPriorImage(): MemoryMap | null {
    return this.priorImage;
  }

  async connect(pipe: BytePipe, opts?: Uv17ProConnectOptions): Promise<IdentResult> {
    this.pipe = pipe;
    this.identComplete = false;
    if (opts?.handshake !== 'none') {
      await handshake(this.layout, pipe, 'read', opts);
      this.identComplete = true;
    }
    return {
      raw: this.layout.ident.slice(),
      modelHints: [...this.layout.modelHints],
    };
  }

  async disconnect(): Promise<void> {
    this.pipe = null;
    this.identComplete = false;
  }

  private requirePipe(): BytePipe {
    if (!this.pipe) {
      throw new RadioProtocolError(
        `${this.layout.protocolLabel} not connected — call connect() first`,
      );
    }
    return this.pipe;
  }

  private async readBlock(pipe: BytePipe, radioAddr: number): Promise<Uint8Array> {
    const frame = makeProgramRwReadFrame(radioAddr, this.layout.blockSize);
    await pipe.write(frame);
    const readResponseLen = 4 + this.layout.blockSize;
    const raw = await waitForReadResponse(pipe, readResponseLen, this.layout.ioTimeoutMs);
    const encrypted = parseProgramRwReadReply(raw, this.layout.blockSize);
    const echoed = (raw[1]! << 8) | raw[2]!;
    if (echoed !== radioAddr) {
      throw new RadioProtocolError(
        `${this.layout.protocolLabel} read reply echoed address 0x${echoed.toString(16)}, expected 0x${radioAddr.toString(16)}`,
      );
    }
    return uv17ProCrypt(encrypted, this.layout.defaultEncrsym);
  }

  /** Write profile; `stock` until a modified-firmware target sets it. */
  private writeProfile: Uv17ProWriteContext['profile'] = 'stock';

  /** For a subclass whose radio has a modified-firmware target (the UV-5R Mini MM9PDY). */
  protected setWriteProfile(profile: Uv17ProWriteContext['profile']): void {
    this.writeProfile = profile;
  }

  getWriteProfile(): Uv17ProWriteContext['profile'] {
    return this.writeProfile;
  }

  /**
   * Frames to write after the clone blocks, or `null`. Called once per upload before the first frame, so an
   * encode error refuses the Write before the radio sees anything. Restore never calls it.
   */
  protected extraUploadFrames(): Uv17ProExtraUploadFrames | null {
    return null;
  }

  /**
   * Restore frames outside the clone (the UV-5R Mini MM9PDY zone table), or `null`. Called once per Restore before
   * the first frame with the region ids the caller selected; it names the ids it consumes, and may throw to refuse
   * the Restore. Written after the clone blocks, in the order given, under the same interlock.
   */
  protected restoreExtraFrames(
    archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
    regionIds: readonly string[],
  ): (Uv17ProExtraUploadFrames & { regionIds: readonly string[] }) | null {
    void archive;
    void regionIds;
    return null;
  }

  /** Read arbitrary 64-byte blocks by radio address (write verify of frames outside the clone). */
  async readBlocks(
    addresses: readonly number[],
    opts: { signal?: AbortSignal } = {},
  ): Promise<Map<number, Uint8Array>> {
    const pipe = this.requirePipe();
    const out = new Map<number, Uint8Array>();
    for (const addr of addresses) {
      throwIfAborted(opts.signal);
      out.set(addr, await this.readBlock(pipe, addr));
    }
    return out;
  }

  /** Refuse the whole plan before any frame (handshake included) when the layout has an interlock. */
  private assertPlanAllowed(
    addrs: readonly number[],
    operation: Uv17ProWriteContext['operation'],
  ): void {
    const guard = this.layout.assertWriteAllowed;
    if (!guard) return;
    for (const addr of addrs) {
      guard(addr, this.layout.blockSize, { profile: this.writeProfile, operation });
    }
  }

  private async writeBlock(
    pipe: BytePipe,
    radioAddr: number,
    plain: Uint8Array,
    operation: Uv17ProWriteContext['operation'],
  ): Promise<void> {
    this.layout.assertWriteAllowed?.(radioAddr, plain.length, {
      profile: this.writeProfile,
      operation,
    });
    if (plain.length !== this.layout.blockSize) {
      throw new RangeError(`Block must be ${this.layout.blockSize} bytes`);
    }
    await flushPipe(pipe);
    const encrypted = uv17ProCrypt(plain, this.layout.defaultEncrsym);
    const frame = makeProgramRwWriteFrame(radioAddr, this.layout.blockSize, encrypted);
    await pipe.write(frame);
    await expectAck(pipe, this.layout.writeAckTimeoutMs);
  }

  async download(
    opts: { onProgress?: ProgressFn; signal?: AbortSignal; progressStage?: string } = {},
  ): Promise<MemoryMap> {
    const pipe = this.requirePipe();
    const addrs = listRadioBlockAddresses(this.layout);
    const image = createMemoryMap(this.layout.memTotal);
    let done = 0;
    const max = this.layout.cloneBlockCount;
    const stage = opts.progressStage;
    for (const addr of addrs) {
      throwIfAborted(opts.signal);
      const block = await this.readBlock(pipe, addr);
      const packed = packedOffsetForRadioAddr(this.layout, addr);
      image.set(packed, block);
      done += 1;
      reportProgress(
        opts.onProgress,
        {
          cur: done,
          max,
          msg: `Reading 0x${addr.toString(16)}`,
          ...(stage ? { stage } : {}),
        },
        opts.signal,
      );
    }
    this.priorImage = memoryMapFromBytes(image.bytes);
    return image;
  }

  async upload(
    image: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    if (image.size < this.layout.memTotal) {
      throw new RangeError(`Upload image must be at least 0x${this.layout.memTotal.toString(16)}`);
    }
    const pipe = this.requirePipe();
    const addrs = listRadioBlockAddresses(this.layout);
    const extra = this.extraUploadFrames();
    const extraFrames = extra?.frames ?? [];
    for (const f of extraFrames) {
      if (f.bytes.length !== this.layout.blockSize) {
        throw new RangeError(`Block must be ${this.layout.blockSize} bytes`);
      }
    }
    this.assertPlanAllowed([...addrs, ...extraFrames.map((f) => f.address)], 'write');
    reportProgress(
      opts.onProgress,
      { cur: 0, max: addrs.length, msg: 'Upload handshake', stage: 'Upload' },
      opts.signal,
    );
    if (!this.identComplete) {
      await handshake(this.layout, pipe, 'upload', { signal: opts.signal });
      this.identComplete = true;
    }
    let done = 0;
    const max = addrs.length;
    const stagingChunks: { address: number; data: Uint8Array }[] = [];
    for (const addr of addrs) {
      throwIfAborted(opts.signal);
      const packed = packedOffsetForRadioAddr(this.layout, addr);
      const plain = image.get(packed, this.layout.blockSize);
      await this.writeBlock(pipe, addr, plain, 'write');
      stagingChunks.push({ address: addr, data: plain.slice() });
      done += 1;
      reportProgress(
        opts.onProgress,
        { cur: done, max, msg: `Writing 0x${addr.toString(16)}`, stage: 'Upload' },
        opts.signal,
      );
    }
    if (extra && extraFrames.length > 0) {
      let extraDone = 0;
      reportProgress(
        opts.onProgress,
        { cur: 0, max: extraFrames.length, msg: extra.stage, stage: extra.stage },
        opts.signal,
      );
      for (const { address, bytes } of extraFrames) {
        throwIfAborted(opts.signal);
        await this.writeBlock(pipe, address, bytes, 'write');
        stagingChunks.push({ address, data: bytes.slice() });
        extraDone += 1;
        reportProgress(
          opts.onProgress,
          {
            cur: extraDone,
            max: extraFrames.length,
            msg: `Writing 0x${address.toString(16)}`,
            stage: extra.stage,
          },
          opts.signal,
        );
      }
    }
    this.lastUploadStaging = captureWriteVerifyStaging(stagingChunks);
  }

  /**
   * Replay selected restorable MEM bins as a packed clone upload, then any {@link restoreExtraFrames}.
   * Does not merge channels, assemble, or seed from a project bag.
   */
  async restoreFromBackup(
    archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
    opts: { regionIds: readonly string[]; onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    const pipe = this.requirePipe();
    const memIds = new Set(uv17ProBackupMemSpans(this.layout).map((s) => s.id));
    const extra = this.restoreExtraFrames(archive, opts.regionIds);
    const extraIds = new Set(extra?.regionIds ?? []);
    const extraFrames = extra?.frames ?? [];
    if (this.layout.assertWriteAllowed) {
      const unknown = opts.regionIds.filter((id) => !memIds.has(id) && !extraIds.has(id));
      if (unknown.length > 0) {
        throw new RadioProtocolError(
          `${this.layout.protocolLabel} restore names regions outside the write set: ${unknown.join(', ')}`,
        );
      }
    }
    for (const f of extraFrames) {
      if (f.bytes.length !== this.layout.blockSize) {
        throw new RangeError(`Block must be ${this.layout.blockSize} bytes`);
      }
    }
    const cloneIds = opts.regionIds.filter((id) => memIds.has(id));
    // A Restore of only the extra frames writes no clone block; otherwise the clone rules apply as before.
    const cloneOnlyExtra = cloneIds.length === 0 && extraFrames.length > 0;
    const intended = cloneOnlyExtra
      ? null
      : intendedUv17ProRestoreImage(this.layout, archive, cloneIds);
    const addrs = cloneOnlyExtra
      ? []
      : listUv17ProRestoreWriteAddresses(this.layout, archive, cloneIds);
    this.assertPlanAllowed([...addrs, ...extraFrames.map((f) => f.address)], 'restore');
    const max = addrs.length + extraFrames.length;
    reportProgress(
      opts.onProgress,
      { cur: 0, max, msg: 'Restore handshake', stage: 'Restore' },
      opts.signal,
    );
    if (!this.identComplete) {
      await handshake(this.layout, pipe, 'upload', { signal: opts.signal });
      this.identComplete = true;
    }
    let done = 0;
    const stagingChunks: { address: number; data: Uint8Array }[] = [];
    const frames = [
      ...addrs.map((addr) => ({
        address: addr,
        bytes: intended!.get(packedOffsetForRadioAddr(this.layout, addr), this.layout.blockSize),
      })),
      ...extraFrames,
    ];
    for (const { address, bytes } of frames) {
      throwIfAborted(opts.signal);
      await this.writeBlock(pipe, address, bytes, 'restore');
      stagingChunks.push({ address, data: bytes.slice() });
      done += 1;
      reportProgress(
        opts.onProgress,
        {
          cur: done,
          max,
          msg: `Restoring 0x${address.toString(16)}`,
          stage: 'Restore',
        },
        opts.signal,
      );
    }
    this.lastUploadStaging = captureWriteVerifyStaging(stagingChunks);
  }

  /** Staging chunks from the last successful {@link upload} — consumed once. */
  takeUploadStagingSnapshot(): WriteVerifyStagingSnapshot | undefined {
    const snap = this.lastUploadStaging;
    this.lastUploadStaging = undefined;
    return snap;
  }

  decodeChannels(image: MemoryMap): RadioChannelDto[] {
    return decodeChannelsFromImage(this.layout, image);
  }

  encodeChannels(image: MemoryMap, channels: readonly RadioChannelDto[]): MemoryMap {
    const next = memoryMapFromBytes(image.bytes);
    encodeChannelsIntoImage(this.layout, next, channels);
    if (next.size < this.layout.channelSpan) {
      throw new RangeError('Image too small for channel encode');
    }
    return next;
  }

  readFirmware(image: MemoryMap): string | undefined {
    return readFirmwareFromImage(this.layout, image);
  }
}

export function createUv17ProProtocol(layout: Uv17ProLayout): CloneImageRadio {
  return new Uv17ProProtocol(layout);
}
