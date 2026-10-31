/**
 * RT95 VOX CloneImageRadio — PROGRAM→QX contiguous clone.
 */

import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  enterProgramQxMode,
  enterProgramQxModeWithRetry,
  exitProgramQxMode,
  makeProgramQxReadFrame,
  makeProgramQxWriteFrame,
  parseProgramQxReadReply,
  parseProgramQxWriteAck,
  probeProgramQxIdent,
  PROGRAM_QX_BLOCK_SIZE,
  PROGRAM_QX_READ_REPLY_LEN,
  sendProgramQxCommand,
  type ProgramQxRetryOptions,
} from '../../kit/codecs/programQx.ts';
import { createMemoryMap, memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import type { WriteVerifyStagingSnapshot } from '../../writeVerify.ts';
import { captureWriteVerifyStaging } from '../../writeVerifyCompare.ts';
import {
  RT95_BLOCK_ADDR_END,
  RT95_BLOCK_ADDR_START,
  RT95_BLOCK_SIZE,
  RT95_IMAGE_SIZE,
  RT95_IO_TIMEOUT_MS,
  RT95_UPLOAD_PRIME_ADDR,
} from './constants.ts';
import {
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
  readBandlimitFromImage,
} from './channelCodec.ts';
import { parseRt95IdentResponse } from './ident.ts';
import { intendedRt95RestoreImage } from './restoreFromBackup.ts';
import {
  assertRt95WriteAllowed,
  encodeRt95ModData,
  evaluateRt95ChipGuard,
  rt95ChipGuardRefusalText,
  Rt95WriteRefusedError,
  RT95_GUARD_ALIAS_ADDR,
  RT95_GUARD_IDENT_ADDR,
  type Rt95ChipGuardResult,
  type Rt95ModDataInput,
  type Rt95WriteContext,
} from './modData/index.ts';
import {
  assertRt95SettingsPatchesPermitted,
  rt95PasswordDigitsFromImage,
  type Rt95RadioSettingsSnapshot,
  type Rt95SettingsPatch,
} from './settingsFields.ts';
import {
  assertRt95FreshBlockMatchesPrePause,
  mergeRt95SettingsPatchIntoBlock,
  rt95PatchMaskMap,
  touchedRt95Blocks,
} from './settingsPatch.ts';

export interface Rt95ConnectOptions {
  signal?: AbortSignal;
  handshake?: 'read' | 'none';
  onProgress?: ProgressFn;
}

/**
 * After END the radio ignores PROGRAM for about 3–5 s (the head reloads from the main board).
 * A session opened within this window of Studio's own END retries PROGRAM instead of failing.
 */
export const RT95_FOLLOW_ON_WINDOW_MS = 15_000;

let lastRt95EndAt = 0;

/** When this module last sent END (ms since epoch; 0 = never). */
export function getLastRt95EndAt(): number {
  return lastRt95EndAt;
}

/** Test seam: pretend END was sent at `at` (0 resets). */
export function setRt95EndAtForTests(at: number): void {
  lastRt95EndAt = at;
}

type Rt95RetryTuning = Pick<
  ProgramQxRetryOptions,
  'intervalMs' | 'budgetMs' | 'timeoutMs' | 'sleep' | 'now'
>;
let retryTuning: Rt95RetryTuning = {};

/** Test seam: shrink the PROGRAM retry interval and budget ({} restores the defaults). */
export function setRt95RetryTuningForTests(tuning: Rt95RetryTuning): void {
  retryTuning = tuning;
}

function retryOptions(
  signal: AbortSignal | undefined,
  onProgress: ProgressFn | undefined,
): ProgramQxRetryOptions {
  return {
    timeoutMs: RT95_IO_TIMEOUT_MS,
    ...retryTuning,
    signal,
    onAttempt: (attempt) =>
      reportProgress(
        onProgress,
        { cur: attempt, max: 0, msg: 'Waiting for the radio to finish restarting' },
        signal,
      ),
  };
}

export class Rt95Protocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;
  private radioBandlimit: number | null = null;
  private lastUploadStaging: WriteVerifyStagingSnapshot | undefined;
  private inProgramMode = false;
  private modIntent: Rt95ModDataInput | null = null;
  private lastChipGuard: Rt95ChipGuardResult | undefined;
  private pendingSettingsPatches: readonly Rt95SettingsPatch[] = [];

  /** Field patches for the next {@link upload} or settings-only upload. */
  setUploadSettingsPatches(patches: readonly Rt95SettingsPatch[]): void {
    assertRt95SettingsPatchesPermitted(patches);
    this.pendingSettingsPatches = patches;
  }

  takeUploadSettingsPatches(): readonly Rt95SettingsPatch[] {
    const p = this.pendingSettingsPatches;
    this.pendingSettingsPatches = [];
    return p;
  }

  /**
   * MM9PDY target only: the zones and descriptions the next {@link upload} also writes (MMD1,
   * 0x4000-0x5FF0). `null` (the default) is the stock target, which never touches that range.
   */
  setModDataIntent(intent: Rt95ModDataInput | null): void {
    this.modIntent = intent;
  }

  getModDataIntent(): Rt95ModDataInput | null {
    return this.modIntent;
  }

  /** Result of the last {@link probeChipGuard} (or the guard run inside upload). */
  getLastChipGuard(): Rt95ChipGuardResult | undefined {
    return this.lastChipGuard;
  }

  /**
   * Chip-size probe: read the ident at 0x3B00 and the block at 0x7B00 (a 16 KiB part answers with the
   * ident again). A read that throws counts as failed. Reads only; nothing is written.
   */
  async probeChipGuard(): Promise<Rt95ChipGuardResult> {
    const pipe = this.requirePipe();
    const readOrUndefined = async (addr: number): Promise<Uint8Array | undefined> => {
      try {
        return await this.readBlock(pipe, addr);
      } catch {
        return undefined;
      }
    };
    const ident = await readOrUndefined(RT95_GUARD_IDENT_ADDR);
    const alias = await readOrUndefined(RT95_GUARD_ALIAS_ADDR);
    const result = evaluateRt95ChipGuard(ident, alias);
    this.lastChipGuard = result;
    return result;
  }

  /** Read 16-byte blocks at the given addresses (write verify of the MMD1 range). */
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

  async connect(pipe: BytePipe, opts?: Rt95ConnectOptions): Promise<IdentResult> {
    this.pipe = pipe;
    if (opts?.handshake !== 'none') {
      await flushPipe(pipe);
      if (Date.now() - lastRt95EndAt < RT95_FOLLOW_ON_WINDOW_MS) {
        await enterProgramQxModeWithRetry(pipe, retryOptions(opts?.signal, opts?.onProgress));
      } else {
        await enterProgramQxMode(pipe, RT95_IO_TIMEOUT_MS);
      }
      this.inProgramMode = true;
      const identRaw = await probeProgramQxIdent(pipe, RT95_IO_TIMEOUT_MS);
      const ident = parseRt95IdentResponse(identRaw);
      this.radioBandlimit = ident.bandlimit;
      return {
        raw: identRaw.slice(),
        modelHints: [ident.model],
        firmwareHint: ident.version,
      };
    }
    return { raw: new Uint8Array(0), modelHints: ['RT95-P'] };
  }

  async disconnect(): Promise<void> {
    const pipe = this.pipe;
    this.pipe = null;
    this.radioBandlimit = null;
    const wasInProgramMode = this.inProgramMode;
    this.inProgramMode = false;
    if (pipe) {
      try {
        if (wasInProgramMode) lastRt95EndAt = Date.now();
        await exitProgramQxMode(pipe);
      } catch {
        // best-effort
      }
    }
  }

  /**
   * Make sure the radio is in PC mode (PROGRAM answered, ident still an allowed RT95).
   * After Studio's own END the radio ignores PROGRAM for a few seconds, so this retries.
   */
  async ensureProgramMode(
    opts: { signal?: AbortSignal; onProgress?: ProgressFn } = {},
  ): Promise<void> {
    const pipe = this.requirePipe();
    if (this.inProgramMode) return;
    await enterProgramQxModeWithRetry(pipe, retryOptions(opts.signal, opts.onProgress));
    const identRaw = await probeProgramQxIdent(pipe, RT95_IO_TIMEOUT_MS);
    const ident = parseRt95IdentResponse(identRaw);
    this.radioBandlimit = ident.bandlimit;
    this.inProgramMode = true;
  }

  private requirePipe(): BytePipe {
    if (!this.pipe) {
      throw new RadioProtocolError('RT95 not connected — call connect() first');
    }
    return this.pipe;
  }

  private async readBlock(pipe: BytePipe, addr: number): Promise<Uint8Array> {
    const frame = makeProgramQxReadFrame(addr, PROGRAM_QX_BLOCK_SIZE);
    const reply = await sendProgramQxCommand(
      pipe,
      frame,
      PROGRAM_QX_READ_REPLY_LEN,
      RT95_IO_TIMEOUT_MS,
    );
    return parseProgramQxReadReply(reply, PROGRAM_QX_BLOCK_SIZE);
  }

  /** Every `W` goes through here, behind the hard write interlock. No flag turns it off. */
  private async writeBlock(
    pipe: BytePipe,
    addr: number,
    payload: Uint8Array,
    ctx: Rt95WriteContext,
  ): Promise<void> {
    assertRt95WriteAllowed(addr, payload.length, ctx);
    const frame = makeProgramQxWriteFrame(addr, PROGRAM_QX_BLOCK_SIZE, payload);
    const ack = await sendProgramQxCommand(pipe, frame, 1, RT95_IO_TIMEOUT_MS);
    if (ack.length !== 1) {
      throw new RadioProtocolError(`RT95 write expected 1-byte ACK, got ${ack.length}`);
    }
    parseProgramQxWriteAck(ack[0]!);
  }

  async download(
    opts: { onProgress?: ProgressFn; signal?: AbortSignal; progressStage?: string } = {},
  ): Promise<MemoryMap> {
    const pipe = this.requirePipe();
    const image = createMemoryMap(RT95_IMAGE_SIZE);
    const blockCount = (RT95_BLOCK_ADDR_END - RT95_BLOCK_ADDR_START) / RT95_BLOCK_SIZE + 1;
    let done = 0;
    const stage = opts.progressStage;

    for (let addr = RT95_BLOCK_ADDR_START; addr <= RT95_BLOCK_ADDR_END; addr += RT95_BLOCK_SIZE) {
      throwIfAborted(opts.signal);
      const block = await this.readBlock(pipe, addr);
      image.set(addr, block);
      done += 1;
      reportProgress(
        opts.onProgress,
        {
          cur: done,
          max: blockCount,
          msg: `Reading 0x${addr.toString(16)}`,
          ...(stage ? { stage } : {}),
        },
        opts.signal,
      );
    }

    return image;
  }

  async upload(
    image: MemoryMap,
    opts: {
      onProgress?: ProgressFn;
      signal?: AbortSignal;
      /** Restore passes `'restore'`; Write is the default. */
      operation?: 'write' | 'restore';
      /** Defaults to {@link uploadSettingsPatches} set on the protocol before upload. */
      settingsPatches?: readonly Rt95SettingsPatch[];
    } = {},
  ): Promise<void> {
    if (image.size < RT95_IMAGE_SIZE) {
      throw new RangeError(`Upload image must be at least 0x${RT95_IMAGE_SIZE.toString(16)} bytes`);
    }

    const pipe = this.requirePipe();
    const patches = opts.settingsPatches ?? this.pendingSettingsPatches;
    assertRt95SettingsPatchesPermitted(patches);
    const prePauseBytes = image.bytes.slice();
    const patchMask = rt95PatchMaskMap(patches);
    const touchedBlocks = touchedRt95Blocks(patches);
    // Restore replays a stock backup image: it never carries the MMD1 intent (Backup PR extends this).
    const intent = opts.operation === 'restore' ? null : this.modIntent;
    // Encode first: an input outside the MMD1 limits fails before the radio sees a frame.
    const modBlocks = intent ? encodeRt95ModData(intent, image.bytes).blocks : [];
    const imageBandlimit = readBandlimitFromImage(image);
    if (this.radioBandlimit != null && imageBandlimit !== this.radioBandlimit) {
      // warn only — CHIRP continues upload with bandlimit mismatch
      console.warn(
        `RT95 image bandlimit 0x${imageBandlimit.toString(16)} differs from radio 0x${this.radioBandlimit.toString(16)}`,
      );
    }

    // Write-these-bytes only. Restore calls this with the zip clone — do not download() or overlay here.
    reportProgress(
      opts.onProgress,
      { cur: 0, max: RT95_IMAGE_SIZE / RT95_BLOCK_SIZE, msg: 'Upload handshake', stage: 'Upload' },
      opts.signal,
    );

    await flushPipe(pipe);
    await enterProgramQxMode(pipe, RT95_IO_TIMEOUT_MS);
    this.inProgramMode = true;
    const identRaw = await probeProgramQxIdent(pipe, RT95_IO_TIMEOUT_MS);
    const ident = parseRt95IdentResponse(identRaw);
    this.radioBandlimit = ident.bandlimit;

    const primeFrame = makeProgramQxReadFrame(RT95_UPLOAD_PRIME_ADDR, PROGRAM_QX_BLOCK_SIZE);
    await sendProgramQxCommand(pipe, primeFrame, PROGRAM_QX_READ_REPLY_LEN, RT95_IO_TIMEOUT_MS);

    const blockCount =
      (RT95_BLOCK_ADDR_END - RT95_BLOCK_ADDR_START) / RT95_BLOCK_SIZE + 1 + modBlocks.length;
    let done = 0;
    const stagingChunks: { address: number; data: Uint8Array }[] = [];
    const ctx: Rt95WriteContext = {
      profile: intent ? 'mm9pdy' : 'stock',
      chipGuardPassed: false,
      operation: opts.operation ?? 'write',
    };

    try {
      if (intent) {
        // Run the guard again in this session: the pre-write probe may be minutes old.
        const guard = await this.probeChipGuard();
        if (!guard.ok) {
          throw new Rt95WriteRefusedError(
            RT95_GUARD_ALIAS_ADDR,
            rt95ChipGuardRefusalText(guard.reason),
          );
        }
        ctx.chipGuardPassed = true;
      }
      const mergedTouchedBlocks = new Map<number, Uint8Array>();
      if (patches.length > 0) {
        for (const addr of [...touchedBlocks].sort((a, b) => a - b)) {
          throwIfAborted(opts.signal);
          const fresh = await this.readBlock(pipe, addr);
          const pre = prePauseBytes.subarray(addr, addr + RT95_BLOCK_SIZE);
          assertRt95FreshBlockMatchesPrePause(addr, pre, fresh, patchMask);
          mergedTouchedBlocks.set(addr, mergeRt95SettingsPatchIntoBlock(fresh, addr, patches));
        }
      }
      for (let addr = RT95_BLOCK_ADDR_START; addr <= RT95_BLOCK_ADDR_END; addr += RT95_BLOCK_SIZE) {
        throwIfAborted(opts.signal);
        const payload = mergedTouchedBlocks.get(addr) ?? image.get(addr, RT95_BLOCK_SIZE);
        await this.writeBlock(pipe, addr, payload, ctx);
        stagingChunks.push({ address: addr, data: payload.slice() });
        done += 1;
        reportProgress(
          opts.onProgress,
          { cur: done, max: blockCount, msg: `Writing 0x${addr.toString(16)}`, stage: 'Upload' },
          opts.signal,
        );
      }
      // MMD1: descriptions, member slots, zone names, then the header last.
      for (const block of modBlocks) {
        throwIfAborted(opts.signal);
        await this.writeBlock(pipe, block.address, block.bytes, ctx);
        stagingChunks.push({ address: block.address, data: block.bytes.slice() });
        done += 1;
        reportProgress(
          opts.onProgress,
          {
            cur: done,
            max: blockCount,
            msg: `Writing 0x${block.address.toString(16)}`,
            stage: 'Upload',
          },
          opts.signal,
        );
      }
      this.lastUploadStaging = captureWriteVerifyStaging(stagingChunks);
      this.pendingSettingsPatches = [];
    } finally {
      this.inProgramMode = false;
      lastRt95EndAt = Date.now();
      await exitProgramQxMode(pipe);
    }
  }

  /**
   * Settings-only write: fresh-read each touched block, abort on drift outside the patch mask,
   * merge patches, and write only those blocks. Never writes channels, MMD1, or ident.
   */
  async uploadSettingsPatches(
    patches: readonly Rt95SettingsPatch[],
    prePauseImage: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {},
  ): Promise<void> {
    if (!this.pipe) {
      throw new RadioProtocolError('RT95 not connected');
    }
    if (patches.length === 0) {
      throw new RadioProtocolError('RT95 settings upload has no patches');
    }
    assertRt95SettingsPatchesPermitted(patches);
    const prePauseBytes = prePauseImage.bytes.slice();
    const patchMask = rt95PatchMaskMap(patches);
    const touchedBlocks = touchedRt95Blocks(patches);
    const pipe = this.requirePipe();
    const ctx: Rt95WriteContext = {
      profile: this.modIntent ? 'mm9pdy' : 'stock',
      chipGuardPassed: false,
      operation: 'write',
    };

    reportProgress(
      opts.onProgress,
      { cur: 0, max: touchedBlocks.size, msg: 'Upload handshake', stage: 'Upload' },
      opts.signal,
    );

    await flushPipe(pipe);
    await enterProgramQxMode(pipe, RT95_IO_TIMEOUT_MS);
    this.inProgramMode = true;
    const identRaw = await probeProgramQxIdent(pipe, RT95_IO_TIMEOUT_MS);
    const ident = parseRt95IdentResponse(identRaw);
    this.radioBandlimit = ident.bandlimit;

    const primeFrame = makeProgramQxReadFrame(RT95_UPLOAD_PRIME_ADDR, PROGRAM_QX_BLOCK_SIZE);
    await sendProgramQxCommand(pipe, primeFrame, PROGRAM_QX_READ_REPLY_LEN, RT95_IO_TIMEOUT_MS);

    const stagingChunks: { address: number; data: Uint8Array }[] = [];
    let done = 0;
    try {
      const mergedByBlock = new Map<number, Uint8Array>();
      for (const addr of [...touchedBlocks].sort((a, b) => a - b)) {
        throwIfAborted(opts.signal);
        const fresh = await this.readBlock(pipe, addr);
        const pre = prePauseBytes.subarray(addr, addr + RT95_BLOCK_SIZE);
        assertRt95FreshBlockMatchesPrePause(addr, pre, fresh, patchMask);
        mergedByBlock.set(addr, mergeRt95SettingsPatchIntoBlock(fresh, addr, patches));
      }
      for (const addr of [...touchedBlocks].sort((a, b) => a - b)) {
        throwIfAborted(opts.signal);
        const payload = mergedByBlock.get(addr)!;
        await this.writeBlock(pipe, addr, payload, ctx);
        stagingChunks.push({ address: addr, data: payload.slice() });
        done += 1;
        reportProgress(
          opts.onProgress,
          {
            cur: done,
            max: touchedBlocks.size,
            msg: `Writing 0x${addr.toString(16)}`,
            stage: 'Upload',
          },
          opts.signal,
        );
      }
      this.lastUploadStaging = captureWriteVerifyStaging(stagingChunks);
    } finally {
      this.inProgramMode = false;
      lastRt95EndAt = Date.now();
      await exitProgramQxMode(pipe);
    }
  }

  /** Download the clone image for settings read/decode. */
  async readSettingsSnapshot(opts?: {
    signal?: AbortSignal;
    onProgress?: ProgressFn;
  }): Promise<Rt95RadioSettingsSnapshot> {
    const image = await this.download({
      signal: opts?.signal,
      onProgress: opts?.onProgress,
      progressStage: 'Read settings',
    });
    return {
      image: image.bytes.slice(),
      bandlimit: readBandlimitFromImage(image),
    };
  }

  /** Exposed for password enable checks against the pre-pause image. */
  rt95PasswordDigitsFromPrePauseImage(image: MemoryMap): string | undefined {
    return rt95PasswordDigitsFromImage(image.bytes);
  }

  async restoreFromBackup(
    archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
    opts: { regionIds: readonly string[]; onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    const intended = intendedRt95RestoreImage(archive, opts.regionIds);
    await this.upload(intended, {
      operation: 'restore',
      signal: opts.signal,
      onProgress: (p) => {
        const msg =
          p.msg === 'Upload handshake'
            ? 'Restore handshake'
            : p.msg.startsWith('Writing ')
              ? `Restoring ${p.msg.slice('Writing '.length)}`
              : p.msg;
        reportProgress(opts.onProgress, { ...p, msg, stage: 'Restore' }, opts.signal);
      },
    });
  }

  /** Staging chunks from the last successful {@link upload} — consumed once. */
  takeUploadStagingSnapshot(): WriteVerifyStagingSnapshot | undefined {
    const snap = this.lastUploadStaging;
    this.lastUploadStaging = undefined;
    return snap;
  }

  decodeChannels(image: MemoryMap): RadioChannelDto[] {
    return decodeChannelsFromImage(image);
  }

  encodeChannels(image: MemoryMap, channels: readonly RadioChannelDto[]): MemoryMap {
    const next = memoryMapFromBytes(image.bytes.slice());
    encodeChannelsIntoImage(next, channels);
    return next;
  }

  readFirmware(image: MemoryMap): string | undefined {
    void image;
    return undefined;
  }
}

async function flushPipe(pipe: BytePipe): Promise<void> {
  if (pipe.flush) {
    await pipe.flush();
  }
}

export function createRt95Protocol(): CloneImageRadio {
  return new Rt95Protocol();
}
