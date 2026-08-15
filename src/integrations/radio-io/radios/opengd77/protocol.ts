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
  parseWriteAck,
} from '../../kit/codecs/opengd77Serial.ts';
import { RadioProtocolError, RadioWrongIdentError } from '../../kit/errors.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import {
  DM1701_RADIO_TYPES,
  type OpenGd77PowerStep,
  OPENGD77_BAUD_RATE,
  OPENGD77_CMD_CLOSE_CPS,
  OPENGD77_CMD_CONTROL,
  OPENGD77_CMD_SHOW_CPS,
  OPENGD77_CONTROL_SAVE_REBOOT,
  OPENGD77_IDENT_TIMEOUT_MS,
  OPENGD77_IO_TIMEOUT_MS,
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
} from './constants.ts';
import {
  countOccupiedChannels,
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
} from './channelCodec.ts';
import {
  collectDirtySectors,
  createOpenUv380Image,
  openUv380DownloadByteCount,
  openUv380ImageFromBytes,
  readAbs,
  writeAbs,
} from './memory.ts';
import { openGd77KeptRegionLength, openGd77KeptRegions } from './writeVerifySupport.ts';
import { encodeOpenGd77WriteImageFromPrior } from './hydration.ts';
import { ADDITIONAL_SETTINGS_BYTES, overlaySatelliteBank } from './satelliteCodec.ts';
import type { WriteVerifyStagingSnapshot } from '../../writeVerify.ts';
import { captureWriteVerifyStaging } from '../../writeVerifyCompare.ts';
import { intendedOpenGd77RestoreImage } from './restoreFromBackup.ts';
import { encodeOpenGd77UserDatabase, decodeUserDatabaseHeader } from './userDatabaseCodec.ts';
import {
  openGd77MissingExtendedCallsignDbWarning,
  overlayUserDatabaseSpanOnSector,
  userDatabaseFlashSpans,
  userDatabaseSectorAbsSet,
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

async function sendCommand(pipe: BytePipe, flag: number, payload?: Uint8Array): Promise<void> {
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

async function writeFlashSector(
  pipe: BytePipe,
  sectorAbs: number,
  payload: Uint8Array,
  signal?: AbortSignal,
): Promise<void> {
  if (payload.length !== OPENGD77_SECTOR) {
    throw new RangeError(`Flash sector payload must be ${OPENGD77_SECTOR} bytes`);
  }
  throwIfAborted(signal);
  await pipe.write(makeSetFlashSectorFrame(OPENGD77_WRITE_VARIANT, sectorAbs));
  parseWriteAck(
    await pipe.readExact(2, OPENGD77_IO_TIMEOUT_MS),
    OPENGD77_WRITE_VARIANT,
    OPENGD77_WRITE_CMD_SET_SECTOR,
  );

  for (let off = 0; off < OPENGD77_SECTOR; off += OPENGD77_BLOCK) {
    throwIfAborted(signal);
    const chunk = payload.subarray(off, off + OPENGD77_BLOCK);
    await pipe.write(makeWriteSectorBufferFrame(OPENGD77_WRITE_VARIANT, sectorAbs + off, chunk));
    parseWriteAck(
      await pipe.readExact(2, OPENGD77_IO_TIMEOUT_MS),
      OPENGD77_WRITE_VARIANT,
      OPENGD77_WRITE_CMD_SECTOR_BUFFER,
    );
  }

  await pipe.write(makeFinishFlashSectorFrame(OPENGD77_WRITE_VARIANT));
  parseWriteAck(
    await pipe.readExact(2, OPENGD77_IO_TIMEOUT_MS),
    OPENGD77_WRITE_VARIANT,
    OPENGD77_WRITE_CMD_FINISH_SECTOR,
  );
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
    this.pipe = pipe;
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
    return {
      raw: infoPayload,
      firmwareHint: info.fwRevision || undefined,
      modelHints: [...this.modelHints],
    };
  }

  async disconnect(): Promise<void> {
    if (this.pipe) {
      try {
        await sendCommand(this.pipe, OPENGD77_CMD_CLOSE_CPS);
      } catch {
        /* best-effort */
      }
    }
    this.pipe = null;
  }

  async download(opts: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    /** Override default progress step label (`FLASH image`). */
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
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 upload: not connected');

    // Ensure CPS mode for write-only connect.
    try {
      await sendCommand(pipe, OPENGD77_CMD_SHOW_CPS);
    } catch {
      /* may already be in CPS */
    }

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
      await writeFlashSector(pipe, sector.sectorAbs, sector.payload, opts.signal);
      reportProgress(opts.onProgress, {
        cur: i + 1,
        max: Math.max(sectors.length, 1),
        msg: `Writing FLASH sector 0x${sector.sectorAbs.toString(16)}`,
        stage: 'FLASH sectors',
      });
    }

    this.lastUploadStaging = captureWriteVerifyStaging(
      sectors.map((sector) => ({ address: sector.sectorAbs, data: sector.payload })),
    );

    if (userDatabaseContacts !== undefined) {
      await this.programUserDatabaseSectors(pipe, userDatabaseContacts, opts);
    }

    await pipe.write(
      makeCommandFrame(OPENGD77_CMD_CONTROL, new Uint8Array([OPENGD77_CONTROL_SAVE_REBOOT])),
    );
    try {
      parseCommandAck(await pipe.readExact(1, OPENGD77_IO_TIMEOUT_MS));
    } catch {
      /* reboot may drop the port */
    }

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
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 User Database write: not connected');
    try {
      await sendCommand(pipe, OPENGD77_CMD_SHOW_CPS);
    } catch {
      /* may already be in CPS */
    }
    await this.programUserDatabaseSectors(pipe, contacts, opts);
    await pipe.write(
      makeCommandFrame(OPENGD77_CMD_CONTROL, new Uint8Array([OPENGD77_CONTROL_SAVE_REBOOT])),
    );
    try {
      parseCommandAck(await pipe.readExact(1, OPENGD77_IO_TIMEOUT_MS));
    } catch {
      /* reboot may drop the port */
    }
  }

  private async programUserDatabaseSectors(
    pipe: BytePipe,
    contacts: readonly RadioDigitalContactDto[],
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    this.lastUserDatabaseWarning = openGd77MissingExtendedCallsignDbWarning(
      this.firmwareInfo?.features ?? 0,
    );
    const encoded = encodeOpenGd77UserDatabase(contacts);
    const spans = userDatabaseFlashSpans(encoded);
    const sectorAbsList = userDatabaseSectorAbsSet(spans);
    const payloads = new Map<number, Uint8Array>();
    for (const sectorAbs of sectorAbsList) {
      throwIfAborted(opts.signal);
      const sector = await readFlashRange(pipe, sectorAbs, OPENGD77_SECTOR);
      for (const span of spans) {
        overlayUserDatabaseSpanOnSector(sector, sectorAbs, span);
      }
      payloads.set(sectorAbs, sector);
    }
    let i = 0;
    for (const sectorAbs of sectorAbsList) {
      throwIfAborted(opts.signal);
      await writeFlashSector(pipe, sectorAbs, payloads.get(sectorAbs)!, opts.signal);
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
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 satellite write: not connected');

    this.pendingWriteProjection = null;

    try {
      await sendCommand(pipe, OPENGD77_CMD_SHOW_CPS);
    } catch {
      /* may already be in CPS */
    }

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
      await writeFlashSector(pipe, sector.sectorAbs, sector.payload, opts.signal);
      reportProgress(opts.onProgress, {
        cur: i + 1,
        max: Math.max(sectors.length, 1),
        msg: `Writing FLASH sector 0x${sector.sectorAbs.toString(16)}`,
        stage: 'FLASH sectors',
      });
    }

    await pipe.write(
      makeCommandFrame(OPENGD77_CMD_CONTROL, new Uint8Array([OPENGD77_CONTROL_SAVE_REBOOT])),
    );
    try {
      parseCommandAck(await pipe.readExact(1, OPENGD77_IO_TIMEOUT_MS));
    } catch {
      /* reboot may drop the port */
    }

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
    let entryCount = 0;
    try {
      entryCount = decodeUserDatabaseHeader(header).entryCount;
    } catch {
      return new Uint8Array(0);
    }
    entryCount = Math.min(entryCount, OPENGD77_USER_DATABASE_MAX);
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
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 restore: not connected');

    this.pendingWriteProjection = null;

    try {
      await sendCommand(pipe, OPENGD77_CMD_SHOW_CPS);
    } catch {
      /* may already be in CPS */
    }

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
      await writeFlashSector(pipe, sector.sectorAbs, sector.payload, opts.signal);
      reportProgress(opts.onProgress, {
        cur: i + 1,
        max: Math.max(sectors.length, 1),
        msg: `Restoring FLASH sector 0x${sector.sectorAbs.toString(16)}`,
        stage: 'Restore',
      });
    }

    await pipe.write(
      makeCommandFrame(OPENGD77_CMD_CONTROL, new Uint8Array([OPENGD77_CONTROL_SAVE_REBOOT])),
    );
    try {
      parseCommandAck(await pipe.readExact(1, OPENGD77_IO_TIMEOUT_MS));
    } catch {
      /* reboot may drop the port */
    }

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
