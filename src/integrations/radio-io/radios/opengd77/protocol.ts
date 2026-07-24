/**
 * OpenUV380 CloneImageRadio — C/R/X serial download/upload.
 * Cite: docs/reference/radios/opengd77/protocol.md;
 * qdmr opengd77_interface.cc (facts only; GPL-3).
 */

import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
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
  writeAbs,
} from './memory.ts';

/** Packed FirmwareInfo size (qdmr FirmwareInfo). */
export const OPENGD77_FIRMWARE_INFO_SIZE = 46;

export interface OpenGd77FirmwareInfo {
  structVersion: number;
  radioType: number;
  fwRevision: string;
  buildDate: string;
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
}

export class OpenGd77Protocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;
  private firmwareInfo: OpenGd77FirmwareInfo | null = null;
  /** Image from last download or seed — used for dirty-sector upload. */
  private priorImage: MemoryMap | null = null;
  private readonly allowedRadioTypes: readonly number[];
  private readonly modelHints: readonly string[];

  constructor(opts?: OpenGd77ProtocolOptions) {
    this.allowedRadioTypes = opts?.allowedRadioTypes ?? DM1701_RADIO_TYPES;
    this.modelHints = opts?.modelHints ?? ['DM-1701', 'RT-84'];
  }

  /** Seed prior image from hydration before upload (write path). */
  seedPriorImage(image: MemoryMap): void {
    this.priorImage = openUv380ImageFromBytes(image.bytes);
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
        `OpenGD77 radioType 0x${info.radioType.toString(16)} is not a supported DM-1701/RT-84 (expected ${[...this.allowedRadioTypes].map((t) => `0x${t.toString(16)}`).join('/')})`,
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

  async download(opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<MemoryMap> {
    const pipe = this.pipe;
    if (!pipe) throw new RadioProtocolError('OpenGD77 download: not connected');

    const image = createOpenUv380Image();
    const total = openUv380DownloadByteCount();
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

    const prior = this.priorImage;
    const sectors = prior
      ? collectDirtySectors(prior, image)
      : collectDirtySectors(createOpenUv380Image(), image);

    for (let i = 0; i < sectors.length; i++) {
      throwIfAborted(opts.signal);
      const sector = sectors[i]!;
      await writeFlashSector(pipe, sector.sectorAbs, sector.payload, opts.signal);
      reportProgress(opts.onProgress, {
        cur: i + 1,
        max: Math.max(sectors.length, 1),
        msg: `Writing FLASH sector 0x${sector.sectorAbs.toString(16)}`,
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

    this.priorImage = openUv380ImageFromBytes(image.bytes);
  }

  decodeChannels(image: MemoryMap): RadioChannelDto[] {
    return decodeChannelsFromImage(image);
  }

  encodeChannels(image: MemoryMap, channels: RadioChannelDto[]): MemoryMap {
    const next = openUv380ImageFromBytes(image.bytes);
    encodeChannelsIntoImage(next, channels);
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
  });
}

export { OPENGD77_BAUD_RATE, countOccupiedChannels, isDm1701RadioType };
