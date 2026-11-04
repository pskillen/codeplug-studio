/**
 * OpenUV380 CloneImageRadio — C/R/X serial download/upload.
 * Cite: docs/reference/radios/opengd77/protocol.md;
 * qdmr opengd77_interface.cc (facts only; GPL-3).
 */

import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { RadioDigitalContactDto, RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import {
  makeCommandFrame,
  makeFinishFlashSectorFrame,
  makeOpenGd77ReadFrame,
  makePingFrame,
  makeSetFlashSectorFrame,
  makeWriteSectorBufferFrame,
  OPENGD77_BLOCK,
  OPENGD77_CMD_OK,
  OPENGD77_SECTOR,
  OPENGD77_WRITE_CMD_FINISH_SECTOR,
  OPENGD77_WRITE_CMD_SECTOR_BUFFER,
  OPENGD77_WRITE_CMD_SET_SECTOR,
  parseCommandAck,
  parseOpenGd77ReadReply,
  readOpenGd77WriteAck,
} from '../../kit/codecs/opengd77Serial.ts';
import {
  RadioIoError,
  RadioProtocolError,
  RadioTimeoutError,
  RadioWrongIdentError,
} from '../../kit/errors.ts';
import { FrameTrace, TracingPipe, hexBytes } from '../../kit/frameTrace.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import {
  DM1701_RADIO_TYPES,
  type OpenGd77PowerStep,
  OPENGD77_BAUD_RATE,
  OPENGD77_CMD_CLOSE_CPS,
  OPENGD77_CMD_CONTROL,
  OPENGD77_CMD_SHOW_CPS,
  OPENGD77_CONTROL_FLASH_RED_LED,
  OPENGD77_CONTROL_REBOOT_ONLY,
  OPENGD77_CONTROL_SAVE_REBOOT,
  OPENGD77_CONTROL_SAVE_SETTINGS_AND_VFOS,
  OPENGD77_IDENT_TIMEOUT_MS,
  OPENGD77_IO_TIMEOUT_MS,
  OPENGD77_RECOVERY_REPLY_TIMEOUT_MS,
  OPENGD77_SECTOR_ATTEMPTS,
  OPENGD77_SETTLE_MS,
  OPENGD77_MEM_FIRMWARE_INFO,
  OPENGD77_MEM_FLASH,
  OPENGD77_WRITE_VARIANT,
  OPENUV380_FLASH_SPANS,
  OPENUV380_OFFSET,
  OPENUV380_USER_DB_ENTRIES0_ABS,
  OPENUV380_USER_DB_ENTRIES0_MAX,
  OPENUV380_USER_DB_ENTRIES1_ABS,
  OPENUV380_USER_DB_ENTRY_SIZE,
  OPENUV380_USER_DB_HEADER_ABS,
  OPENUV380_USER_DB_HEADER_SIZE,
  OPENGD77_USER_DATABASE_MAX,
  OPENGD77_1701_POWER_STEPS,
  OPENGD77_MD9600_POWER_STEPS,
  MD9600_RADIO_TYPES,
  OPENGD77_QUICKKEYS_END,
  OPENGD77_QUICKKEYS_START,
} from './constants.ts';
import {
  countOccupiedChannels,
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
} from './channelCodec.ts';
import {
  allSectorBlocks,
  collectDirtySectors,
  createOpenUv380Image,
  dirtySectorChunks,
  type DirtySector,
  openUv380DownloadByteCount,
  openUv380ImageFromBytes,
  readAbs,
  writeAbs,
} from './memory.ts';
import {
  OpenGd77WriteDesyncError,
  OpenGd77WriteNackError,
  OpenGd77WriteStaleBytesError,
  OpenGd77WriteTimeoutError,
  OpenGd77WriteVerifyError,
  type OpenGd77WriteCommand,
  type OpenGd77WriteContext,
  type OpenGd77WritePhase,
} from './writeErrors.ts';
import { openGd77KeptRegionLength, openGd77KeptRegions } from './writeVerifySupport.ts';
import { encodeOpenGd77WriteImageFromPrior } from './hydration.ts';
import { ADDITIONAL_SETTINGS_BYTES, overlaySatelliteBank } from './satelliteCodec.ts';
import type { WriteVerifyStagingSnapshot } from '../../writeVerify.ts';
import { captureWriteVerifyStaging } from '../../writeVerifyCompare.ts';
import { intendedOpenGd77RestoreImage } from './restoreFromBackup.ts';
import { encodeOpenGd77UserDatabase, decodeUserDatabaseHeader } from './userDatabaseCodec.ts';
import {
  openGd77MissingExtendedCallsignDbWarning,
  buildUserDatabaseSectorPayloads,
} from './userDatabaseWrite.ts';

/** Packed FirmwareInfo size (qdmr FirmwareInfo). */
export const OPENGD77_FIRMWARE_INFO_SIZE = 46;

export interface OpenGd77FirmwareInfo {
  structVersion: number;
  radioType: number;
  fwRevision: string;
  buildDate: string;
  /** FirmwareInfo features bitflags (bit 1 = extended callsign DB). */
  features: number;
}

function readU32Le(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! << 24)) >>>
    0
  );
}

function readAsciiPad(buf: Uint8Array, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = buf[offset + i]!;
    if (c === 0) break;
    if (c >= 32 && c < 127) s += String.fromCharCode(c);
  }
  return s.trim();
}

export function parseFirmwareInfo(payload: Uint8Array): OpenGd77FirmwareInfo {
  if (payload.length < OPENGD77_FIRMWARE_INFO_SIZE) {
    throw new RadioProtocolError(
      `FirmwareInfo expected ${OPENGD77_FIRMWARE_INFO_SIZE} bytes, got ${payload.length}`,
    );
  }
  return {
    structVersion: readU32Le(payload, 0),
    radioType: readU32Le(payload, 4),
    fwRevision: readAsciiPad(payload, 8, 16),
    buildDate: readAsciiPad(payload, 24, 16),
    features: payload.length >= 46 ? payload[44]! | (payload[45]! << 8) : 0,
  };
}

function isDm1701RadioType(radioType: number): boolean {
  return (DM1701_RADIO_TYPES as readonly number[]).includes(radioType);
}

async function flushPipe(pipe: BytePipe): Promise<void> {
  if (pipe.flush) await pipe.flush();
}

/** Discard (and return) anything already buffered; pipes without `drain` just flush. */
async function drainPipe(pipe: BytePipe): Promise<Uint8Array> {
  if (pipe.drain) return pipe.drain();
  await flushPipe(pipe);
  return new Uint8Array(0);
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * Send a `C` command and read its one-byte `'-'` ACK. Stale bytes are drained first, so a
 * leftover `'-'` (for example from an earlier NACK) cannot pass for this command's ACK.
 */
async function sendCommand(pipe: BytePipe, flag: number, payload?: Uint8Array): Promise<void> {
  await drainPipe(pipe);
  await pipe.write(makeCommandFrame(flag, payload));
  const ack = await pipe.readExact(1, OPENGD77_IO_TIMEOUT_MS);
  parseCommandAck(ack);
}

async function readMem(
  pipe: BytePipe,
  mem: 0x01 | 0x09,
  addr: number,
  length: number,
): Promise<Uint8Array> {
  await pipe.write(makeOpenGd77ReadFrame(mem, addr, length));
  // Reply: 'R' + u16 BE length + payload
  const header = await pipe.readExact(3, OPENGD77_IO_TIMEOUT_MS);
  if (header[0] !== 0x52) {
    throw new RadioProtocolError(`OpenGD77 read expected 'R', got 0x${header[0]!.toString(16)}`);
  }
  const len = ((header[1]! << 8) | header[2]!) >>> 0;
  const payload = await pipe.readExact(len, OPENGD77_IO_TIMEOUT_MS);
  return parseOpenGd77ReadReply(
    new Uint8Array([header[0]!, header[1]!, header[2]!, ...payload]),
    length,
  );
}

async function readFlashRange(pipe: BytePipe, abs: number, length: number): Promise<Uint8Array> {
  const out = new Uint8Array(length);
  for (let off = 0; off < length; off += OPENGD77_BLOCK) {
    const n = Math.min(OPENGD77_BLOCK, length - off);
    const payload = await readMem(pipe, OPENGD77_MEM_FLASH, abs + off, n);
    out.set(payload, off);
  }
  return out;
}

/** Failures a sector restart can clear: a refusal, a wrong or missing reply, stray bytes, bad read-back. */
function isSectorAnomaly(
  err: unknown,
): err is
  | OpenGd77WriteNackError
  | OpenGd77WriteDesyncError
  | OpenGd77WriteTimeoutError
  | OpenGd77WriteStaleBytesError
  | OpenGd77WriteVerifyError {
  return (
    err instanceof OpenGd77WriteNackError ||
    err instanceof OpenGd77WriteDesyncError ||
    err instanceof OpenGd77WriteTimeoutError ||
    err instanceof OpenGd77WriteStaleBytesError ||
    err instanceof OpenGd77WriteVerifyError
  );
}

/** Which sector of the current write is being programmed, for error context. */
interface WriteSectorPlace {
  phase: OpenGd77WritePhase;
  /** 1-based. */
  index: number;
  total: number;
}

export interface OpenGd77ProtocolOptions {
  /** Allowed radioType values (default DM-1701 / RGB). */
  allowedRadioTypes?: readonly number[];
  modelHints?: readonly string[];
  /** Binary power ladder for channel encode/decode (default 1701). */
  powerSteps?: readonly OpenGd77PowerStep[];
  /** Short label for ident mismatch errors. */
  identLabel?: string;
}

export const OPENGD77_ZERO_DIRTY_SECTORS_MESSAGE =
  'OpenGD77 Write programmed 0 FLASH sectors — the live radio already matched this build. The DM-1701 stays in the current zone unless FLASH is rewritten.';

export class OpenGd77Protocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;
  private firmwareInfo: OpenGd77FirmwareInfo | null = null;
  /** Image from last download — used for dirty-sector upload. Never bag-seeded on Write. */
  private priorImage: MemoryMap | null = null;
  /** Modelled overlay applied after the in-session pre-write read (drop-stash Write). */
  private pendingWriteProjection: {
    channels: readonly RadioChannelDto[];
    organisation?: RadioWriteOrganisation;
  } | null = null;
  private lastDirtySectorCount = 0;
  private lastUploadStaging: WriteVerifyStagingSnapshot | undefined;
  private lastUploadKept: Map<string, Uint8Array> | undefined;
  private lastUserDatabaseWarning: string | undefined;
  /** Last frames on the wire; attached to protocol errors as `debugText`. */
  private trace = new FrameTrace();
  /**
   * Whether this session has pushed the radio's CPS screen. SHOW_CPS stacks a menu level every time
   * (firmware `menuSystem.c:263-279`) and CLOSE_CPS pops one, so it is sent once and closed once.
   */
  private cpsShown = false;
  /** Set when the first SET_SECTOR of a write is sent; cleared by a successful save-and-reboot. */
  private programmingStarted = false;
  private guardDepth = 0;
  /** Scales the settle waits (tests pass 0). */
  private settleScale = 1;
  private readonly allowedRadioTypes: readonly number[];
  private readonly modelHints: readonly string[];
  private readonly powerSteps: readonly OpenGd77PowerStep[];
  private readonly identLabel: string;

  constructor(opts?: OpenGd77ProtocolOptions) {
    this.allowedRadioTypes = opts?.allowedRadioTypes ?? DM1701_RADIO_TYPES;
    this.modelHints = opts?.modelHints ?? ['DM-1701', 'RT-84'];
    this.powerSteps = opts?.powerSteps ?? OPENGD77_1701_POWER_STEPS;
    this.identLabel = opts?.identLabel ?? 'DM-1701/RT-84';
  }

  /** Seed prior image from a MemoryMap (tests / leftover bag merge). Write does not call this. */
  seedPriorImage(image: MemoryMap): void {
    this.priorImage = openUv380ImageFromBytes(image.bytes);
  }

  getPriorImage(): MemoryMap | null {
    return this.priorImage ? openUv380ImageFromBytes(this.priorImage.bytes) : null;
  }

  getPowerSteps(): readonly OpenGd77PowerStep[] {
    return this.powerSteps;
  }

  getLastDirtySectorCount(): number {
    return this.lastDirtySectorCount;
  }

  getLastUserDatabaseWarning(): string | undefined {
    return this.lastUserDatabaseWarning;
  }

  /** Arm modelled overlay; {@link upload} encodes onto the live pre-write prior, not this image. */
  armWriteProjection(
    channels: readonly RadioChannelDto[],
    organisation?: RadioWriteOrganisation,
  ): void {
    this.pendingWriteProjection = { channels, organisation };
  }

  getFirmwareInfo(): OpenGd77FirmwareInfo | null {
    return this.firmwareInfo;
  }

  async connect(
    pipe: BytePipe,
    opts?: { signal?: AbortSignal; settleScale?: number; handshake?: 'read' | 'none' },
  ): Promise<IdentResult> {
    this.trace = new FrameTrace();
    this.cpsShown = false;
    this.programmingStarted = false;
    this.settleScale = opts?.settleScale ?? 1;
    this.pipe = new TracingPipe(pipe, this.trace);
    pipe = this.pipe;
    if (opts?.handshake === 'none') {
      return { raw: new Uint8Array(0), modelHints: [...this.modelHints] };
    }
    throwIfAborted(opts?.signal);
    await flushPipe(pipe);

    // Ping (optional ACK '-')
    await pipe.write(makePingFrame());
    try {
      const pingAck = await pipe.readExact(1, OPENGD77_IDENT_TIMEOUT_MS);
      if (pingAck[0] !== OPENGD77_CMD_OK) {
        // Some firmwares may not ACK ping the same way — continue to FirmwareInfo.
      }
    } catch {
      /* ping optional */
    }

    throwIfAborted(opts?.signal);
    const infoPayload = await readMem(
      pipe,
      OPENGD77_MEM_FIRMWARE_INFO,
      0,
      OPENGD77_FIRMWARE_INFO_SIZE,
    );
    const info = parseFirmwareInfo(infoPayload);
    this.firmwareInfo = info;

    if (!this.allowedRadioTypes.includes(info.radioType)) {
      throw new RadioWrongIdentError(
        `OpenGD77 radioType 0x${info.radioType.toString(16)} is not supported for ${this.identLabel} (expected ${[...this.allowedRadioTypes].map((t) => `0x${t.toString(16)}`).join('/')})`,
      );
    }

    await sendCommand(pipe, OPENGD77_CMD_SHOW_CPS);
    this.cpsShown = true;
    return {
      raw: infoPayload,
      firmwareHint: info.fwRevision || undefined,
      modelHints: [...this.modelHints],
    };
  }

  async disconnect(): Promise<void> {
    await this.recoverRadio();
    this.pipe = null;
  }

  /**
   * Put the radio back after a session, once: reboot-only (`C 06 01`) when a flash sector write
   * began (the only thing that clears the firmware's open sector and CPS screen; no settings
   * re-save, same as a power cycle), else CLOSE_CPS once if this session showed the CPS screen.
   * Never `C 06 00`: that re-saves RAM settings over a half-written FLASH. Best effort.
   */
  private async recoverRadio(): Promise<'rebooted' | 'closed' | 'none'> {
    const pipe = this.pipe;
    if (!pipe) return 'none';
    if (this.programmingStarted) {
      this.programmingStarted = false;
      this.cpsShown = false;
      let sent = false;
      // A reply still pending (a split frame's second half) keeps the radio busy, and a frame sent
      // meanwhile is dropped; let it finish and clear the line first.
      try {
        await this.settleAndDrain(pipe);
      } catch {
        /* best-effort */
      }
      try {
        await pipe.write(
          makeCommandFrame(OPENGD77_CMD_CONTROL, new Uint8Array([OPENGD77_CONTROL_REBOOT_ONLY])),
        );
        sent = true;
      } catch {
        /* the port may already be gone */
      }
      // Best-effort one-byte read, recorded in the trace. Every `C` command is answered `'-'`
      // (usb_com.c:913-917), also one the radio dropped as busy (usbd_cdc_if.c:475-481), so the
      // reply cannot confirm the restart. Never throws: the port may drop on reset.
      let reply = 'not sent (write failed)';
      if (sent) {
        try {
          const ack = await pipe.readExact(1, OPENGD77_RECOVERY_REPLY_TIMEOUT_MS);
          reply = `reply ${hexBytes(ack)}`;
        } catch {
          reply = 'no reply (the port may have dropped on reset)';
        }
      }
      this.trace.push('NOTE', `sent reboot-only (C 06 01) after a failed write; ${reply}`);
      return 'rebooted';
    }
    if (this.cpsShown) {
      this.cpsShown = false;
      try {
        await sendCommand(pipe, OPENGD77_CMD_CLOSE_CPS);
      } catch {
        /* best-effort */
      }
      return 'closed';
    }
    return 'none';
  }

  /**
   * Run a public operation; on failure put the radio back, then attach the frame trace (and, when
   * a reboot was sent, say so) to the error. Nested calls leave that to the outermost one.
   */
  private async guarded<T>(fn: () => Promise<T>): Promise<T> {
    this.guardDepth++;
    try {
      return await fn();
    } catch (err) {
      if (this.guardDepth > 1) throw err;
      const outcome = await this.recoverRadio();
      if (err instanceof RadioIoError) {
        if (outcome === 'rebooted') {
          err.message +=
            " The radio was sent a restart command and may hold a partly written codeplug. The radio answers '-' to every command, including one it dropped because it was busy, so it may still be on the CPS screen: power-cycle it if it does not restart.";
        }
        const text = this.trace.format();
        if (text) err.debugText = text;
      }
      throw err;
    } finally {
      this.guardDepth--;
    }
  }

  /** SHOW_CPS once per session. A failure is swallowed (the radio may already be in CPS). */
  private async ensureCps(pipe: BytePipe): Promise<void> {
    if (this.cpsShown) return;
    try {
      await sendCommand(pipe, OPENGD77_CMD_SHOW_CPS);
      this.cpsShown = true;
    } catch {
      /* may already be in CPS */
    }
  }

  private async prepareCallsignDbFlashWrite(pipe: BytePipe): Promise<void> {
    await this.ensureCps(pipe);
    await sendCommand(pipe, OPENGD77_CMD_CONTROL, new Uint8Array([OPENGD77_CONTROL_FLASH_RED_LED]));
    await sendCommand(
      pipe,
      OPENGD77_CMD_CONTROL,
      new Uint8Array([OPENGD77_CONTROL_SAVE_SETTINGS_AND_VFOS]),
    );
  }

  /** Save RAM settings and reboot (success path only); the reboot clears all firmware write state. */
  private async saveAndReboot(pipe: BytePipe): Promise<void> {
    await pipe.write(
      makeCommandFrame(OPENGD77_CMD_CONTROL, new Uint8Array([OPENGD77_CONTROL_SAVE_REBOOT])),
    );
    this.programmingStarted = false;
    this.cpsShown = false;
    try {
      parseCommandAck(await pipe.readExact(1, OPENGD77_IO_TIMEOUT_MS));
    } catch {
      /* reboot may drop the port */
    }
  }

  /** Wait for the radio to go quiet, then discard (and return) whatever it sent meanwhile. */
  private async settleAndDrain(pipe: BytePipe): Promise<Uint8Array> {
    await sleep(OPENGD77_SETTLE_MS * this.settleScale);
    return drainPipe(pipe);
  }

  /**
   * One flash sector, restarted cleanly on any anomaly. The host can split one frame into two USB
   * packets; the radio takes the first as a whole frame and answers the rest with a busy `'-'`, so
   * a `'-'` may precede a real ACK and a split can leave zeros or the wrong sector in its buffer
   * under good ACKs. Nothing reaches flash before FINISH and SET_SECTOR re-reads the sector, so a
   * restart is: settle, drain, SET_SECTOR again (a refused one closes any open sector without
   * writing), resend every owned block, FINISH, then read the owned bytes back. At most
   * {@link OPENGD77_SECTOR_ATTEMPTS} attempts; the last failure is thrown, noting the count.
   */
  private async writeFlashSector(
    pipe: BytePipe,
    sector: DirtySector,
    place: WriteSectorPlace,
    signal?: AbortSignal,
  ): Promise<void> {
    if (sector.payload.length !== OPENGD77_SECTOR) {
      throw new RangeError(`Flash sector payload must be ${OPENGD77_SECTOR} bytes`);
    }
    for (let attempt = 1; ; attempt++) {
      throwIfAborted(signal);
      try {
        await this.programSectorOnce(pipe, sector, place, attempt, signal);
        return;
      } catch (err) {
        if (!isSectorAnomaly(err)) throw err;
        if (attempt >= OPENGD77_SECTOR_ATTEMPTS) {
          err.message += ` Gave up after ${attempt} attempts at this sector.`;
          throw err;
        }
        this.trace.push(
          'NOTE',
          `sector 0x${sector.sectorAbs.toString(16)} attempt ${attempt + 1}: ${err.message}`,
        );
        await this.settleAndDrain(pipe);
      }
    }
  }

  /** One attempt at a sector; throws a typed anomaly error for {@link writeFlashSector} to act on. */
  private async programSectorOnce(
    pipe: BytePipe,
    sector: DirtySector,
    place: WriteSectorPlace,
    attempt: number,
    signal?: AbortSignal,
  ): Promise<void> {
    const ctxOf = (command: OpenGd77WriteCommand, offset: number): OpenGd77WriteContext => ({
      sectorAbs: sector.sectorAbs,
      sectorIndex: place.index,
      sectorsTotal: place.total,
      phase: place.phase,
      command,
      offset,
    });
    /** Any byte already on the line when a frame is about to go means the framing is suspect. */
    const requireQuietLine = async (ctx: OpenGd77WriteContext): Promise<void> => {
      const stale = await drainPipe(pipe);
      if (stale.length > 0) throw new OpenGd77WriteStaleBytesError(ctx, stale);
    };
    const readAck = async (ctx: OpenGd77WriteContext, cmdByte: number): Promise<'ack' | 'nack'> => {
      let result;
      try {
        result = await readOpenGd77WriteAck(
          pipe,
          OPENGD77_WRITE_VARIANT,
          cmdByte,
          OPENGD77_IO_TIMEOUT_MS,
        );
      } catch (err) {
        if (err instanceof RadioTimeoutError) {
          throw new OpenGd77WriteTimeoutError(ctx, OPENGD77_IO_TIMEOUT_MS, err.message);
        }
        throw err;
      }
      if (result.kind === 'unexpected') throw new OpenGd77WriteDesyncError(ctx, result.bytes);
      return result.kind;
    };
    const send = async (
      command: OpenGd77WriteCommand,
      cmdByte: number,
      offset: number,
      frame: Uint8Array,
    ): Promise<'ack' | 'nack'> => {
      const ctx = ctxOf(command, offset);
      await requireQuietLine(ctx);
      await pipe.write(frame);
      return readAck(ctx, cmdByte);
    };
    const expectAck = async (
      command: OpenGd77WriteCommand,
      cmdByte: number,
      offset: number,
      frame: Uint8Array,
    ): Promise<void> => {
      if ((await send(command, cmdByte, offset, frame)) === 'nack') {
        throw new OpenGd77WriteNackError(ctxOf(command, offset));
      }
    };

    const setFrame = makeSetFlashSectorFrame(OPENGD77_WRITE_VARIANT, sector.sectorAbs);
    this.programmingStarted = true;
    if (attempt === 1) {
      await expectAck('set-sector', OPENGD77_WRITE_CMD_SET_SECTOR, 0, setFrame);
    } else if ((await send('set-sector', OPENGD77_WRITE_CMD_SET_SECTOR, 0, setFrame)) === 'nack') {
      // A sector was open (this one half-filled, a wrong one, or none we know of): the refusal
      // closed it without writing. Settle, clear the line, and open the target for real.
      await this.settleAndDrain(pipe);
      await expectAck('set-sector', OPENGD77_WRITE_CMD_SET_SECTOR, 0, setFrame);
    }

    for (const off of sector.blocks) {
      throwIfAborted(signal);
      const chunk = sector.payload.subarray(off, off + OPENGD77_BLOCK);
      await expectAck(
        'sector-buffer',
        OPENGD77_WRITE_CMD_SECTOR_BUFFER,
        off,
        makeWriteSectorBufferFrame(OPENGD77_WRITE_VARIANT, sector.sectorAbs + off, chunk),
      );
    }

    await expectAck(
      'finish',
      OPENGD77_WRITE_CMD_FINISH_SECTOR,
      0,
      makeFinishFlashSectorFrame(OPENGD77_WRITE_VARIANT),
    );

    // Read the owned bytes back: a split can corrupt the sector buffer under good ACKs.
    for (const off of sector.blocks) {
      throwIfAborted(signal);
      const ctx = ctxOf('verify', off);
      await requireQuietLine(ctx);
      let got: Uint8Array;
      try {
        got = await readMem(pipe, OPENGD77_MEM_FLASH, sector.sectorAbs + off, OPENGD77_BLOCK);
      } catch (err) {
        if (err instanceof RadioIoError && err.code !== 'aborted' && err.code !== 'closed') {
          throw new OpenGd77WriteVerifyError(ctx, err.message);
        }
        throw err;
      }
      const want = sector.payload.subarray(off, off + OPENGD77_BLOCK);
      // The radio keeps its own QuickKeys whatever was sent (restore carries the backup's).
      const bad = want.findIndex((b, i) => {
        const at = sector.sectorAbs + off + i;
        if (at >= OPENGD77_QUICKKEYS_START && at < OPENGD77_QUICKKEYS_END) return false;
        return got[i] !== b;
      });
      if (bad >= 0) {
        throw new OpenGd77WriteVerifyError(
          ctx,
          `byte +0x${(off + bad).toString(16)} is 0x${got[bad]!.toString(16)}, sent 0x${want[bad]!.toString(16)}`,
        );
      }
    }
  }

  async download(opts: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    /** Override default progress step label (`FLASH image`). */
    progressStage?: string;
  }): Promise<MemoryMap> {
    return this.guarded(() => this.downloadImpl(opts));
  }

  private async downloadImpl(opts: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    progressStage?: string;
  }): Promise<MemoryMap> {
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 download: not connected');

    const image = createOpenUv380Image();
    const total = openUv380DownloadByteCount();
    const stage = opts.progressStage ?? 'FLASH image';
    let done = 0;

    for (const span of OPENUV380_FLASH_SPANS) {
      for (let off = 0; off < span.length; off += OPENGD77_BLOCK) {
        throwIfAborted(opts.signal);
        const abs = span.start + off;
        const len = Math.min(OPENGD77_BLOCK, span.length - off);
        const payload = await readMem(pipe, OPENGD77_MEM_FLASH, abs, len);
        writeAbs(image, abs, payload);
        done += len;
        reportProgress(opts.onProgress, {
          cur: done,
          max: total,
          msg: `Reading FLASH 0x${abs.toString(16)}`,
          stage,
        });
      }
    }

    this.priorImage = openUv380ImageFromBytes(image.bytes);
    return image;
  }

  async upload(
    image: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    return this.guarded(() => this.uploadImpl(image, opts));
  }

  private async uploadImpl(
    image: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 upload: not connected');

    // CPS mode is entered once per session (connect already did, unless handshake was 'none').
    await this.ensureCps(pipe);

    // Live radio flash is the encode base and the dirty-sector diff prior.
    // Never overlay onto a blank 0xff map — empty prior after this read refuses Write.
    await this.download({
      onProgress: opts.onProgress,
      signal: opts.signal,
      progressStage: 'Pre-write read',
    });

    const prior = this.priorImage;
    if (!prior) {
      throw new RadioProtocolError('OpenGD77 upload: pre-write read did not establish priorImage');
    }

    let intended = image;
    let userDatabaseContacts: readonly RadioDigitalContactDto[] | undefined;
    if (this.pendingWriteProjection) {
      const pending = this.pendingWriteProjection;
      this.pendingWriteProjection = null;
      userDatabaseContacts = pending.organisation?.userDatabaseContacts;
      intended = encodeOpenGd77WriteImageFromPrior(prior, pending.channels, pending.organisation, {
        powerSteps: this.powerSteps,
      });
    }

    const sectors = collectDirtySectors(prior, intended);
    this.lastDirtySectorCount = sectors.length;

    const kept = new Map<string, Uint8Array>();
    for (const region of openGd77KeptRegions()) {
      const len = openGd77KeptRegionLength(region.id);
      kept.set(region.id, readAbs(prior, region.absAddress, len));
    }
    this.lastUploadKept = kept;

    if (sectors.length === 0) {
      reportProgress(opts.onProgress, {
        cur: 1,
        max: 1,
        msg: OPENGD77_ZERO_DIRTY_SECTORS_MESSAGE,
        stage: 'FLASH sectors',
      });
    }

    for (let i = 0; i < sectors.length; i++) {
      throwIfAborted(opts.signal);
      const sector = sectors[i]!;
      await this.writeFlashSector(
        pipe,
        sector,
        { phase: 'codeplug', index: i + 1, total: sectors.length },
        opts.signal,
      );
      reportProgress(opts.onProgress, {
        cur: i + 1,
        max: Math.max(sectors.length, 1),
        msg: `Writing FLASH sector 0x${sector.sectorAbs.toString(16)}`,
        stage: 'FLASH sectors',
      });
    }

    this.lastUploadStaging = captureWriteVerifyStaging(sectors.flatMap(dirtySectorChunks));

    if (userDatabaseContacts !== undefined) {
      await this.programUserDatabaseSectors(pipe, userDatabaseContacts, opts);
    }

    await this.saveAndReboot(pipe);

    this.priorImage = openUv380ImageFromBytes(intended.bytes);
  }

  /**
   * User Database only: program occupied FLASH sectors at 0x50000 / 0xd8000, SAVE_REBOOT.
   * Does not overlay the programming image.
   */
  async uploadUserDatabase(
    contacts: readonly RadioDigitalContactDto[],
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    return this.guarded(() => this.uploadUserDatabaseImpl(contacts, opts));
  }

  private async uploadUserDatabaseImpl(
    contacts: readonly RadioDigitalContactDto[],
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 User Database write: not connected');
    await this.ensureCps(pipe);
    await this.programUserDatabaseSectors(pipe, contacts, opts);
    await this.saveAndReboot(pipe);
  }

  private async programUserDatabaseSectors(
    pipe: BytePipe,
    contacts: readonly RadioDigitalContactDto[],
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    this.lastUserDatabaseWarning = openGd77MissingExtendedCallsignDbWarning(
      this.firmwareInfo?.features ?? 0,
    );
    await this.prepareCallsignDbFlashWrite(pipe);
    const encoded = encodeOpenGd77UserDatabase(contacts);
    const payloads = buildUserDatabaseSectorPayloads(encoded);
    const sectorAbsList = [...payloads.keys()].sort((a, b) => a - b);
    let i = 0;
    for (const sectorAbs of sectorAbsList) {
      throwIfAborted(opts.signal);
      await this.writeFlashSector(
        pipe,
        { sectorAbs, payload: payloads.get(sectorAbs)!, blocks: allSectorBlocks() },
        { phase: 'user-database', index: i + 1, total: sectorAbsList.length },
        opts.signal,
      );
      i++;
      reportProgress(opts.onProgress, {
        cur: i,
        max: Math.max(sectorAbsList.length, 1),
        msg: `Writing User Database sector 0x${sectorAbs.toString(16)}`,
        stage: 'User Database',
      });
    }
  }

  /**
   * Keps-only write: overlay satellite bank (additional-settings block 3) onto a
   * fresh FLASH read, program dirty sectors, SAVE_REBOOT. Does not run modelled
   * channel encode — Write codeplug never writes keps (#1121).
   */
  async uploadSatelliteBank(
    bank: Uint8Array,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    return this.guarded(() => this.uploadSatelliteBankImpl(bank, opts));
  }

  private async uploadSatelliteBankImpl(
    bank: Uint8Array,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 satellite write: not connected');

    this.pendingWriteProjection = null;

    await this.ensureCps(pipe);

    await this.download({
      onProgress: opts.onProgress,
      signal: opts.signal,
      progressStage: 'Pre-write read',
    });

    const prior = this.priorImage;
    if (!prior) {
      throw new RadioProtocolError(
        'OpenGD77 satellite write: pre-write read did not establish priorImage',
      );
    }

    const intended = openUv380ImageFromBytes(prior.bytes);
    const existing = readAbs(
      intended,
      OPENUV380_OFFSET.additionalSettings,
      ADDITIONAL_SETTINGS_BYTES,
    );
    writeAbs(intended, OPENUV380_OFFSET.additionalSettings, overlaySatelliteBank(existing, bank));

    const sectors = collectDirtySectors(prior, intended);
    this.lastDirtySectorCount = sectors.length;

    for (let i = 0; i < sectors.length; i++) {
      throwIfAborted(opts.signal);
      const sector = sectors[i]!;
      await this.writeFlashSector(
        pipe,
        sector,
        { phase: 'keps', index: i + 1, total: sectors.length },
        opts.signal,
      );
      reportProgress(opts.onProgress, {
        cur: i + 1,
        max: Math.max(sectors.length, 1),
        msg: `Writing FLASH sector 0x${sector.sectorAbs.toString(16)}`,
        stage: 'FLASH sectors',
      });
    }

    await this.saveAndReboot(pipe);

    this.priorImage = openUv380ImageFromBytes(intended.bytes);
  }

  /**
   * Occupied User Database bytes (header + packed entries). Empty when FLASH
   * has no `Id` header. Does not walk qdmr size1.
   */
  async downloadUserDatabaseOccupied(opts?: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
  }): Promise<Uint8Array> {
    return this.guarded(() => this.downloadUserDatabaseOccupiedImpl(opts));
  }

  private async downloadUserDatabaseOccupiedImpl(opts?: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
  }): Promise<Uint8Array> {
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 User Database read: not connected');
    reportProgress(opts?.onProgress, {
      cur: 0,
      max: 1,
      msg: 'Reading User Database header',
      stage: 'User Database',
    });
    const header = await readFlashRange(
      pipe,
      OPENUV380_USER_DB_HEADER_ABS,
      OPENUV380_USER_DB_HEADER_SIZE,
    );
    let entryCount: number;
    try {
      entryCount = Math.min(
        decodeUserDatabaseHeader(header).entryCount,
        OPENGD77_USER_DATABASE_MAX,
      );
    } catch {
      return new Uint8Array(0);
    }
    const n0 = Math.min(entryCount, OPENUV380_USER_DB_ENTRIES0_MAX);
    const n1 = Math.max(0, entryCount - n0);
    const entries0 = new Uint8Array(n0 * OPENUV380_USER_DB_ENTRY_SIZE);
    const entries1 = new Uint8Array(n1 * OPENUV380_USER_DB_ENTRY_SIZE);
    const total = header.byteLength + entries0.byteLength + entries1.byteLength;
    let done = header.byteLength;
    if (entries0.byteLength > 0) {
      const raw = await readFlashRange(pipe, OPENUV380_USER_DB_ENTRIES0_ABS, entries0.byteLength);
      entries0.set(raw);
      done += entries0.byteLength;
      reportProgress(opts?.onProgress, {
        cur: done,
        max: total,
        msg: 'Reading User Database segment 0',
        stage: 'User Database',
      });
    }
    if (entries1.byteLength > 0) {
      const raw = await readFlashRange(pipe, OPENUV380_USER_DB_ENTRIES1_ABS, entries1.byteLength);
      entries1.set(raw);
      done += entries1.byteLength;
      reportProgress(opts?.onProgress, {
        cur: done,
        max: total,
        msg: 'Reading User Database segment 1',
        stage: 'User Database',
      });
    }
    const out = new Uint8Array(total);
    out.set(header, 0);
    out.set(entries0, header.byteLength);
    out.set(entries1, header.byteLength + entries0.byteLength);
    return out;
  }

  /**
   * Replay archive FLASH spans vs a blank prior, then SAVE_REBOOT.
   * Does not download live FLASH, arm a write projection, or encode a build.
   */
  async restoreFromBackup(
    archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
    opts: { regionIds: readonly string[]; onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    return this.guarded(() => this.restoreFromBackupImpl(archive, opts));
  }

  private async restoreFromBackupImpl(
    archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
    opts: { regionIds: readonly string[]; onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 restore: not connected');

    this.pendingWriteProjection = null;

    await this.ensureCps(pipe);

    const intended = intendedOpenGd77RestoreImage(archive, opts.regionIds);
    const sectors = collectDirtySectors(createOpenUv380Image(), intended);
    this.lastDirtySectorCount = sectors.length;

    reportProgress(opts.onProgress, {
      cur: 0,
      max: Math.max(sectors.length, 1),
      msg: 'Restoring backup FLASH…',
      stage: 'Restore',
    });

    for (let i = 0; i < sectors.length; i++) {
      throwIfAborted(opts.signal);
      const sector = sectors[i]!;
      await this.writeFlashSector(
        pipe,
        sector,
        { phase: 'restore', index: i + 1, total: sectors.length },
        opts.signal,
      );
      reportProgress(opts.onProgress, {
        cur: i + 1,
        max: Math.max(sectors.length, 1),
        msg: `Restoring FLASH sector 0x${sector.sectorAbs.toString(16)}`,
        stage: 'Restore',
      });
    }

    await this.saveAndReboot(pipe);

    this.priorImage = openUv380ImageFromBytes(intended.bytes);
  }

  takeUploadStagingSnapshot(): WriteVerifyStagingSnapshot | undefined {
    const snap = this.lastUploadStaging;
    this.lastUploadStaging = undefined;
    return snap;
  }

  takeUploadKeptSnapshot(): Map<string, Uint8Array> | undefined {
    const snap = this.lastUploadKept;
    this.lastUploadKept = undefined;
    if (!snap) return undefined;
    return new Map([...snap.entries()].map(([id, data]) => [id, data.slice()]));
  }

  decodeChannels(image: MemoryMap): RadioChannelDto[] {
    return decodeChannelsFromImage(image, this.powerSteps);
  }

  encodeChannels(image: MemoryMap, channels: RadioChannelDto[]): MemoryMap {
    const next = openUv380ImageFromBytes(image.bytes);
    encodeChannelsIntoImage(next, channels, { powerSteps: this.powerSteps });
    return next;
  }

  readFirmware(image: MemoryMap): string | undefined {
    void image;
    return this.firmwareInfo?.fwRevision || undefined;
  }
}

export function createOpenGd77Dm1701Protocol(): CloneImageRadio {
  return new OpenGd77Protocol({
    allowedRadioTypes: DM1701_RADIO_TYPES,
    modelHints: ['DM-1701', 'RT-84', 'Baofeng DM-1701'],
    powerSteps: OPENGD77_1701_POWER_STEPS,
    identLabel: 'DM-1701/RT-84',
  });
}

export function createOpenGd77Md9600Protocol(): CloneImageRadio {
  return new OpenGd77Protocol({
    allowedRadioTypes: MD9600_RADIO_TYPES,
    modelHints: ['MD-9600', 'RT-90', 'TYT MD-9600', 'Retevis RT-90'],
    powerSteps: OPENGD77_MD9600_POWER_STEPS,
    identLabel: 'MD-9600/RT-90',
  });
}

export { OPENGD77_BAUD_RATE, countOccupiedChannels, isDm1701RadioType };
