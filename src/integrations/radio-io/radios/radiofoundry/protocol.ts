/**
 * RadioFoundry codeplug over the programming cable, any board.
 *
 * Debug-link command 0x1C (CODEPLUG), direct mode, image offsets.
 * RadioFoundry docs/spec/cps-fast.md and docs/spec/debuglink.md §2 and §3.20.
 * The radio adds its own physical base (`RadioFoundryBoardLimits.PHYSICAL_CODEPLUG_BASE`);
 * this module never sends it, never speaks the
 * OpenGD77 R/X/W codec, and never falls through to the stock DM-32 PROGRAM writer.
 * COMMIT reloads the codeplug. There is no reboot command.
 */

import {
  RADIOFOUNDRY_IMAGE_SIZE,
  SETTINGS_AREA_ADDRESS,
  SETTINGS_AREA_SIZE,
} from '@core/import-export/formats/radiofoundry/layout.ts';
import {
  readRadioFoundrySettingsArea,
  type SettingsArea,
} from '@core/import-export/formats/radiofoundry/settingsArea.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { crc32Ieee } from '../../kit/checksums.ts';
import {
  summariseRadioFoundryBuild,
  type RadioFoundryBuildIdentity,
} from '@core/radios/radiofoundry/firmware.ts';
import {
  RadioInterlockError,
  RadioProtocolError,
  RadioTimeoutError,
  RadioWrongIdentError,
} from '../../kit/errors.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { reportProgress } from '../../kit/progress.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import {
  BLOCK_SIZE,
  CODEPLUG_COMMAND,
  DATA_CHUNK_MAX,
  EEPROM_IMAGE_END,
  FMT_BLANK,
  FMT_LZ4,
  FLASH_IMAGE_START,
  HANDSHAKE_ERROR,
  MODE_DIRECT,
  OP_ABORT,
  OP_BEGIN,
  OP_BLOCK,
  OP_COMMIT,
  OP_DATA,
  OP_END,
  OP_INFO,
  OP_READ,
  OP_SUMS,
  servedBlockAddresses,
} from './constants.ts';
import type { RadioFoundryCableBoard } from './board.ts';
import {
  decodeDebugFrame,
  encodeDebugFrame,
  type DebugFrame,
} from '../../kit/codecs/radioFoundryDebugLink.ts';
import { DMR_ID_DATABASE_AREA2_ADDRESS, dmrIdDatabaseArea2Blocks } from './idDatabase.ts';
import { decodeBlock, encodeBlock } from './lz4.ts';
import {
  isRadioFoundryBoardName,
  parseRadioFoundryVersionText,
  RADIOFOUNDRY_VERSION_COMMAND,
  RADIOFOUNDRY_VERSION_TIMEOUT_MS,
} from './version.ts';
import {
  ownedPrivateContactBlocks,
  radioFoundryWriteSourceFromAssembled,
  type RadioFoundryWriteSource,
} from './writeSource.ts';
import { SAT_ALLOWED_OPS, SATELLITE_COMMAND } from './satellite.ts';

const REPLY_COMMAND = CODEPLUG_COMMAND | 0x80;
const PRE_WRITE_STAGE = 'Pre-write read';
const BLOCKS_STAGE = 'Codeplug blocks';
const STORAGE_FOREIGN_REFUSAL =
  'This radio\'s flash still holds settings from the firmware it ran before, so RadioFoundry will not save anything to it. Claim the storage area with RadioFoundry\'s web programming utility (it backs up first) or with "rfoundry_debug.py storage claim", then write again. Nothing was written.';

const CODEPLUG_OP_NAMES: Record<number, string> = {
  [OP_INFO]: 'INFO',
  [OP_SUMS]: 'SUMS',
  [OP_READ]: 'READ',
  [OP_BEGIN]: 'BEGIN',
  [OP_BLOCK]: 'BLOCK',
  [OP_DATA]: 'DATA',
  [OP_END]: 'END',
  [OP_COMMIT]: 'COMMIT',
  [OP_ABORT]: 'ABORT',
};

const REFUSAL_REASONS: ReadonlyArray<{ name: string; sentence: string } | null> = [
  null,
  {
    name: 'RANGE',
    sentence:
      "The block is outside the codeplug image, misaligned, or touches one of the radio's protected areas (settings, journal, calibration).",
  },
  {
    name: 'STORAGE',
    sentence: STORAGE_FOREIGN_REFUSAL,
  },
  {
    name: 'NO_STAGING',
    sentence: 'Staged writes are not available on this radio.',
  },
  {
    name: 'STAGE_FULL',
    sentence: 'The staging area is full.',
  },
  {
    name: 'STAGE_BUSY',
    sentence: 'The staging area is busy with another operation.',
  },
  {
    name: 'STATE',
    sentence: 'The radio is not in a state that accepts this codeplug command.',
  },
  {
    name: 'CRC',
    sentence: 'The block data did not match the checksum the radio expected.',
  },
  {
    name: 'STREAM',
    sentence: 'The radio did not accept the block data stream.',
  },
  {
    name: 'FLASH',
    sentence: 'A flash erase, program or read-back failed on the radio.',
  },
];

const INTERLOCK_REFUSAL_REASONS = new Set([1, 2, 9]);
// Status 3 is busy: wait 5 s and sleep 20 ms between replies, then fail.
const BUSY_WAIT_MS = 5000;
const BUSY_GAP_MS = 20;
const COMMIT_STAGE = 'Commit';

interface FastInfo {
  flags: number;
  dataChunk: number;
  readMax: number;
  sumsMax: number;
  /** Exclusive image end: the lower of the INFO reply and the board's. */
  imageEnd: number;
  /** EEPROM image size the radio reports (checked against the codec layout). */
  eepromEnd: number;
  /** Flash image start the radio reports (checked against the codec layout). */
  flashStart: number;
  /** Physical base of the open-firmware image, as reported; checked against the board at connect. */
  physicalBase: number;
}

interface BlockSum {
  crc: number;
  blank: boolean;
}

export class RadioFoundryCableProtocol implements CloneImageRadio {
  constructor(readonly board: RadioFoundryCableBoard) {}

  private pipe: BytePipe | null = null;
  private seq = 1;
  private info: FastInfo | null = null;
  private readBlocks: Map<number, Uint8Array> | null = null;
  private armed: RadioFoundryWriteSource | null = null;
  private version: RadioFoundryBuildIdentity | null = null;

  /** The build the radio reported at connect, or null when it reported none. */
  firmwareVersion(): RadioFoundryBuildIdentity | null {
    return this.version;
  }

  /** INFO flag bit 1 (`storage_ready`): null before connect. */
  storageWritable(): boolean | null {
    if (!this.info) return null;
    return (this.info.flags & 0x02) !== 0;
  }

  /** One VERSION exchange. Never throws: any failure means "not reported". */
  private async readVersion(): Promise<RadioFoundryBuildIdentity | null> {
    const pipe = this.requirePipe();
    const seq = this.seq & 0xff;
    this.seq = (this.seq + 1) & 0xff;
    try {
      await pipe.write(encodeDebugFrame(RADIOFOUNDRY_VERSION_COMMAND, seq, new Uint8Array(0)));
      const frame = await readFrame(pipe, RADIOFOUNDRY_VERSION_TIMEOUT_MS);
      if (
        frame.command !== (RADIOFOUNDRY_VERSION_COMMAND | 0x80) ||
        frame.seq !== seq ||
        frame.payload.length < 1 ||
        frame.payload[0] !== 0
      ) {
        return null;
      }
      return parseRadioFoundryVersionText(new TextDecoder().decode(frame.payload.subarray(1)));
    } catch {
      // A late reply must not be read as the next codeplug reply.
      await pipe.drain?.();
      return null;
    }
  }

  async connect(pipe: BytePipe): Promise<IdentResult> {
    this.pipe = pipe;
    this.seq = 1;
    this.info = null;
    this.version = null;
    this.readBlocks = null;
    try {
      const body = await this.request(OP_INFO, new Uint8Array(0), 2000);
      this.info = parseInfo(body, this.board);
    } catch (err) {
      this.pipe = null;
      if (err instanceof RadioProtocolError && err.message === HANDSHAKE_ERROR) throw err;
      throw new RadioProtocolError(HANDSHAKE_ERROR);
    }
    const base = this.requireInfo().physicalBase;
    const expected = this.board.limits.PHYSICAL_CODEPLUG_BASE;
    if (base !== expected) {
      this.pipe = null;
      this.info = null;
      throw new RadioWrongIdentError(
        `This radio keeps its codeplug at ${hex(base)}, but the ${this.board.label} keeps it at ${hex(expected)}: it is a different radio. Pick the build for that radio.`,
      );
    }
    this.version = await this.readVersion();
    const reported = this.version?.board;
    if (reported !== undefined && !isRadioFoundryBoardName(this.board, reported)) {
      this.pipe = null;
      this.info = null;
      this.version = null;
      throw new RadioWrongIdentError(
        `This radio reports RadioFoundry board "${reported}", not the ${this.board.label}. Pick the build for that radio.`,
      );
    }
    return {
      raw: new Uint8Array(0),
      modelHints: [this.board.modelHint],
      ...(this.version ? { firmwareHint: summariseRadioFoundryBuild(this.version).label } : {}),
    };
  }

  async disconnect(): Promise<void> {
    this.pipe = null;
    this.info = null;
    this.version = null;
    this.readBlocks = null;
    this.armed = null;
  }

  /** Remember the serialised codeplug. Upload overlays only its owned addresses. */
  armWriteSource(source: RadioFoundryWriteSource): void {
    if (
      source.bytes.length !== RADIOFOUNDRY_IMAGE_SIZE ||
      source.owned.length !== RADIOFOUNDRY_IMAGE_SIZE
    ) {
      throw new RadioProtocolError('RadioFoundry write image is the wrong length.');
    }
    for (let i = SETTINGS_AREA_ADDRESS; i < SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE; i += 1) {
      if (source.owned[i]) {
        throw new RadioProtocolError(
          'This write would change the RadioFoundry settings area. Studio does not write that area yet.',
        );
      }
    }
    const area2 = source.area2;
    const area2Owned = source.area2Owned;
    if (area2 || area2Owned) {
      if (!area2 || !area2Owned || area2.length !== area2Owned.length || area2.length === 0) {
        throw new RadioProtocolError('DMR ID database area 2 is the wrong length.');
      }
      const end = DMR_ID_DATABASE_AREA2_ADDRESS + area2.length;
      if (end > this.board.limits.IMAGE_END) {
        throw new RadioProtocolError('DMR ID database area 2 passes the native codeplug.');
      }
    }
    this.armed = source;
  }

  armAssembled(assembled: AssembledBuild): RadioFoundryWriteSource {
    const source = radioFoundryWriteSourceFromAssembled(assembled, { board: this.board });
    this.armWriteSource(source);
    return source;
  }

  hasReadImage(): boolean {
    return this.readBlocks != null;
  }

  /** The settings area this session read, checked; null before a read. Never decoded past tag headers. */
  settingsArea(): SettingsArea | null {
    const block = this.readBlocks?.get(SETTINGS_AREA_ADDRESS);
    if (!block || block.length < SETTINGS_AREA_SIZE) return null;
    return readRadioFoundrySettingsArea(block.subarray(0, SETTINGS_AREA_SIZE));
  }

  /** True when a directory spill is already in the read cache, or there is no spill. */
  hasDirectoryImage(): boolean {
    const area2 = this.armed?.area2;
    if (!area2?.length || !this.readBlocks) return !area2?.length;
    return dmrIdDatabaseArea2Blocks(area2.length, this.board.limits.IMAGE_END).every((addr) =>
      this.readBlocks!.has(addr),
    );
  }

  async download(opts: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    progressStage?: string;
  }): Promise<MemoryMap> {
    this.requireLink();
    const stage = opts.progressStage ?? 'Codeplug';
    const addresses = this.readAddresses();
    const sums = await this.readSums(addresses, opts.signal);
    const image = new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE);
    image.fill(0xff);
    const blocks = new Map<number, Uint8Array>();
    for (let i = 0; i < addresses.length; i += 1) {
      const addr = addresses[i]!;
      const sum = sums.get(addr);
      if (!sum) throw new RadioProtocolError(`No checksum for block ${hex(addr)}.`);
      const block = sum.blank ? blankBlock() : await this.readBlock(addr, sum.crc, opts.signal);
      if (crc32Ieee(block) !== sum.crc) {
        throw new RadioProtocolError(`Block ${hex(addr)} checksum does not match the radio.`);
      }
      blocks.set(addr, block);
      if (addr < RADIOFOUNDRY_IMAGE_SIZE) {
        const n = Math.min(BLOCK_SIZE, RADIOFOUNDRY_IMAGE_SIZE - addr);
        image.set(block.subarray(0, n), addr);
      }
      reportProgress(
        opts.onProgress,
        {
          cur: i + 1,
          max: addresses.length,
          stage,
          msg: 'Reading codeplug',
        },
        opts.signal,
      );
    }
    this.readBlocks = blocks;
    return memoryMapFromBytes(image);
  }

  /** Image the next upload would send: radio bytes, with owned addresses replaced. */
  overlayWriteImage(): MemoryMap {
    const blocks = this.requireReadBlocks();
    const source = this.requireArmed();
    const image = new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE);
    image.fill(0xff);
    const info = this.requireInfo();
    for (const addr of servedBlockAddresses(
      RADIOFOUNDRY_IMAGE_SIZE,
      info.eepromEnd,
      info.flashStart,
    )) {
      const merged = mergeBlock(blocks.get(addr)!, addr, source);
      const n = Math.min(BLOCK_SIZE, RADIOFOUNDRY_IMAGE_SIZE - addr);
      image.set(merged.subarray(0, n), addr);
    }
    return memoryMapFromBytes(image);
  }

  async upload(
    image: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    void image;
    this.requireArmed();
    // Refuse before the pre-write read when INFO says flash is not writable (foreign storage).
    if (this.storageWritable() === false) {
      throw new RadioInterlockError(STORAGE_FOREIGN_REFUSAL);
    }
    if (!this.readBlocks) {
      await this.download({ ...opts, progressStage: PRE_WRITE_STAGE });
    }
    const jobs = this.changedBlocks();
    if (this.privateContactTableMatches()) {
      reportProgress(
        opts.onProgress,
        { cur: 1, max: 1, stage: BLOCKS_STAGE, msg: 'No contact blocks changed' },
        opts.signal,
      );
    }
    if (jobs.length === 0) {
      reportProgress(
        opts.onProgress,
        { cur: 1, max: 1, stage: BLOCKS_STAGE, msg: 'No codeplug blocks changed' },
        opts.signal,
      );
    }
    await this.request(OP_BEGIN, Uint8Array.of(MODE_DIRECT), 2000);
    try {
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i]!;
        await this.writeBlock(job.addr, job.data, opts.signal);
        reportProgress(
          opts.onProgress,
          {
            cur: i + 1,
            max: jobs.length,
            stage: BLOCKS_STAGE,
            msg: 'Writing codeplug',
          },
          opts.signal,
        );
      }
    } catch (err) {
      await this.request(OP_ABORT, new Uint8Array(0), 2000).catch(() => undefined);
      throw err;
    }
    reportProgress(
      opts.onProgress,
      { cur: 1, max: 1, stage: COMMIT_STAGE, msg: 'Committing codeplug' },
      opts.signal,
    );
    await this.request(OP_COMMIT, new Uint8Array(0), 20000);
    this.readBlocks = null;
  }

  decodeChannels(image: MemoryMap): RadioChannelDto[] {
    void image;
    return [];
  }

  encodeChannels(image: MemoryMap, channels: readonly RadioChannelDto[]): MemoryMap {
    void channels;
    return image;
  }

  readFirmware(image: MemoryMap): string | undefined {
    void image;
    return undefined;
  }

  /** Owned private-contact records already match the bytes read from the radio. */
  private privateContactTableMatches(): boolean {
    const source = this.requireArmed();
    const blocks = this.requireReadBlocks();
    const addrs = ownedPrivateContactBlocks(source);
    if (addrs.length === 0) return false;
    for (const addr of addrs) {
      const radio = blocks.get(addr);
      if (!radio) return false;
      if (!sameBytes(mergeBlock(radio, addr, source), radio)) return false;
    }
    return true;
  }

  private readAddresses(): number[] {
    const info = this.requireInfo();
    const addresses = servedBlockAddresses(
      RADIOFOUNDRY_IMAGE_SIZE,
      info.eepromEnd,
      info.flashStart,
    );
    const area2 = this.armed?.area2;
    if (!area2?.length) return addresses;
    return addresses.concat(dmrIdDatabaseArea2Blocks(area2.length, info.imageEnd));
  }

  private changedBlocks(): { addr: number; data: Uint8Array }[] {
    const blocks = this.requireReadBlocks();
    const source = this.requireArmed();
    const jobs: { addr: number; data: Uint8Array }[] = [];
    for (const addr of this.readAddresses()) {
      const radio = blocks.get(addr);
      if (!radio) throw new RadioProtocolError(`Block ${hex(addr)} was not read.`);
      const want = mergeBlock(radio, addr, source);
      if (!sameBytes(want, radio)) jobs.push({ addr, data: want });
    }
    return jobs;
  }

  private async readSums(
    addresses: number[],
    signal?: AbortSignal,
  ): Promise<Map<number, BlockSum>> {
    const info = this.requireInfo();
    const out = new Map<number, BlockSum>();
    let i = 0;
    while (i < addresses.length) {
      let count = 1;
      while (
        count < info.sumsMax &&
        i + count < addresses.length &&
        addresses[i + count] === addresses[i]! + count * BLOCK_SIZE
      ) {
        count += 1;
      }
      const start = addresses[i]!;
      assertImageBlock(start, info, this.board);
      const args = new Uint8Array(5);
      writeU32(args, 0, start);
      args[4] = count;
      const body = await this.request(OP_SUMS, args, 4000);
      if (body.length < 7 + count * 4) {
        throw new RadioProtocolError('RadioFoundry checksum reply is too short.');
      }
      const mask = body[5]! | (body[6]! << 8);
      for (let j = 0; j < count; j += 1) {
        const crc = readU32(body, 7 + j * 4);
        out.set(start + j * BLOCK_SIZE, { crc, blank: ((mask >> j) & 1) === 1 });
      }
      i += count;
      if (signal?.aborted) throw new RadioProtocolError('Radio I/O operation was aborted.');
    }
    return out;
  }

  private async readBlock(
    addr: number,
    expectCrc: number,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    const info = this.requireInfo();
    assertImageBlock(addr, info, this.board);
    let stream = new Uint8Array(0);
    let total: number | null = null;
    let crc = 0;
    let format = 0;
    while (total === null || stream.length < total) {
      const args = new Uint8Array(6);
      writeU32(args, 0, addr);
      args[4] = stream.length & 0xff;
      args[5] = (stream.length >> 8) & 0xff;
      const body = await this.request(OP_READ, args, 4000);
      if (body.length < 13) throw new RadioProtocolError(`Block ${hex(addr)} read is too short.`);
      const gotAddr = readU32(body, 0);
      const fmt = body[4]!;
      const length = body[5]! | (body[6]! << 8);
      const gotCrc = readU32(body, 7);
      const offset = body[11]! | (body[12]! << 8);
      if (gotAddr !== addr || offset !== stream.length) {
        throw new RadioProtocolError(`Block ${hex(addr)} read window does not match.`);
      }
      if (total !== null && (gotCrc !== crc || length !== total)) {
        throw new RadioProtocolError(`Block ${hex(addr)} changed while it was being read.`);
      }
      format = fmt;
      total = length;
      crc = gotCrc;
      if (format === FMT_BLANK) break;
      // READ_HDR is 15 including the status byte already stripped. The body is
      // 13 field bytes, one unused pad, then the LZ4 stream. A 14-byte body is
      // that pad and no stream: an empty window.
      if (body.length === 14) {
        throw new RadioProtocolError(`Block ${hex(addr)} read returned no bytes.`);
      }
      const chunk = body.subarray(14, Math.min(body.length, 14 + info.readMax));
      if (chunk.length === 0) {
        throw new RadioProtocolError(`Block ${hex(addr)} read returned no bytes.`);
      }
      const next = new Uint8Array(stream.length + chunk.length);
      next.set(stream, 0);
      next.set(chunk, stream.length);
      stream = next;
      if (signal?.aborted) throw new RadioProtocolError('Radio I/O operation was aborted.');
    }
    if (crc !== expectCrc) {
      throw new RadioProtocolError(`Block ${hex(addr)} checksum changed while it was being read.`);
    }
    if (format === FMT_BLANK) return blankBlock();
    const data = decodeBlock(stream, BLOCK_SIZE);
    if (crc32Ieee(data) !== crc) {
      throw new RadioProtocolError(`Block ${hex(addr)} did not decode to the radio's checksum.`);
    }
    return data;
  }

  private async writeBlock(addr: number, data: Uint8Array, signal?: AbortSignal): Promise<void> {
    const info = this.requireInfo();
    assertPlannedWriteBlock(addr, new Set(this.readAddresses()));
    assertImageBlock(addr, info, this.board);
    if (data.length !== BLOCK_SIZE) {
      throw new RadioProtocolError(`Block ${hex(addr)} is not 4096 bytes.`);
    }
    const blank = isBlank(data);
    const stream = blank ? new Uint8Array(0) : encodeBlock(data);
    const args = new Uint8Array(11);
    writeU32(args, 0, addr);
    args[4] = blank ? FMT_BLANK : FMT_LZ4;
    args[5] = stream.length & 0xff;
    args[6] = (stream.length >> 8) & 0xff;
    writeU32(args, 7, crc32Ieee(data));
    await this.request(OP_BLOCK, args, 4000);
    for (let off = 0; off < stream.length; off += info.dataChunk) {
      const piece = stream.subarray(off, Math.min(stream.length, off + info.dataChunk));
      const payload = new Uint8Array(2 + piece.length);
      payload[0] = off & 0xff;
      payload[1] = (off >> 8) & 0xff;
      payload.set(piece, 2);
      const body = await this.request(OP_DATA, payload, 4000);
      const received = body.length >= 2 ? body[0]! | (body[1]! << 8) : -1;
      if (received !== off + piece.length) {
        throw new RadioProtocolError(`Block ${hex(addr)} did not accept the stream.`);
      }
      if (signal?.aborted) throw new RadioProtocolError('Radio I/O operation was aborted.');
    }
    await this.request(OP_END, new Uint8Array(0), 8000);
  }

  /**
   * The only sender of debug-link SATELLITE (0x26). Refuses operations outside SAT_ALLOWED_OPS before writing.
   * Retries status 3 (busy) for up to 5 s. Returns the status and the body after it; never throws on a status.
   */
  async satelliteRequest(
    op: number,
    args: Uint8Array,
    timeoutMs: number,
  ): Promise<{ status: number; body: Uint8Array }> {
    if (!SAT_ALLOWED_OPS.has(op)) {
      throw new RadioInterlockError(`Studio does not send RadioFoundry satellite operation ${op}.`);
    }
    const pipe = this.requirePipe();
    const payload = new Uint8Array(1 + args.length);
    payload[0] = op;
    payload.set(args, 1);
    if (payload.length > 64) {
      throw new RadioProtocolError('RadioFoundry satellite request is longer than 64 bytes.');
    }
    const busyUntil = performance.now() + BUSY_WAIT_MS;
    for (;;) {
      const seq = this.seq & 0xff;
      this.seq = (this.seq + 1) & 0xff;
      await pipe.write(encodeDebugFrame(SATELLITE_COMMAND, seq, payload));
      const frame = await readFrame(pipe, timeoutMs);
      if (
        frame.command !== (SATELLITE_COMMAND | 0x80) ||
        frame.seq !== seq ||
        frame.payload.length < 1
      ) {
        throw new RadioProtocolError('Unexpected RadioFoundry satellite reply.');
      }
      const status = frame.payload[0]!;
      if (status === 3 && performance.now() < busyUntil) {
        await delay(BUSY_GAP_MS);
        continue;
      }
      return { status, body: frame.payload.subarray(1) };
    }
  }

  private async request(op: number, args: Uint8Array, timeoutMs: number): Promise<Uint8Array> {
    const pipe = this.requirePipe();
    const payload = new Uint8Array(1 + args.length);
    payload[0] = op;
    payload.set(args, 1);
    if (payload.length > 64) {
      throw new RadioProtocolError('RadioFoundry codeplug request is longer than 64 bytes.');
    }
    const busyUntil = performance.now() + BUSY_WAIT_MS;
    for (;;) {
      const seq = this.seq & 0xff;
      this.seq = (this.seq + 1) & 0xff;
      await pipe.write(encodeDebugFrame(CODEPLUG_COMMAND, seq, payload));
      let frame: DebugFrame;
      try {
        frame = await readFrame(pipe, timeoutMs);
      } catch (err) {
        if (op === OP_INFO) throw new RadioProtocolError(HANDSHAKE_ERROR);
        throw err;
      }
      if (frame.command !== REPLY_COMMAND || frame.seq !== seq || frame.payload.length < 1) {
        if (op === OP_INFO) throw new RadioProtocolError(HANDSHAKE_ERROR);
        throw new RadioProtocolError('Unexpected RadioFoundry codeplug reply.');
      }
      const status = frame.payload[0]!;
      if (status === 3 && performance.now() < busyUntil) {
        await delay(BUSY_GAP_MS);
        continue;
      }
      if (status !== 0) {
        if (op === OP_INFO || status === 1 || status === 4) {
          throw new RadioProtocolError(HANDSHAKE_ERROR);
        }
        const opName = codeplugOpName(op);
        if (status === 7 && frame.payload.length > 1) {
          throw this.refusalError(opName, status, frame.payload[1]!);
        }
        throw new RadioProtocolError(`RadioFoundry refused ${opName} (status ${status}).`);
      }
      return frame.payload.subarray(1);
    }
  }

  private requireLink(): void {
    this.requirePipe();
    this.requireInfo();
  }

  private requirePipe(): BytePipe {
    if (!this.pipe) throw new RadioProtocolError(HANDSHAKE_ERROR);
    return this.pipe;
  }

  private requireInfo(): FastInfo {
    if (!this.info) throw new RadioProtocolError(HANDSHAKE_ERROR);
    return this.info;
  }

  private requireReadBlocks(): Map<number, Uint8Array> {
    if (!this.readBlocks) {
      throw new RadioProtocolError(
        'Read this radio in the current session before Write. RadioFoundry write will not start from a blank image.',
      );
    }
    return this.readBlocks;
  }

  private requireArmed(): RadioFoundryWriteSource {
    if (!this.armed) {
      throw new RadioProtocolError('RadioFoundry write needs the serialised codeplug image.');
    }
    return this.armed;
  }

  private refusalError(
    opName: string,
    status: number,
    reason: number,
  ): RadioInterlockError | RadioProtocolError {
    const entry = reason >= 1 && reason < REFUSAL_REASONS.length ? REFUSAL_REASONS[reason] : null;
    const name = entry?.name ?? 'UNKNOWN';
    const sentence =
      entry?.sentence ?? `The radio refused codeplug operation ${opName} (reason ${reason}).`;
    const message = `RadioFoundry refused ${opName} (reason ${reason}, ${name}): ${sentence}`;
    const debugText = this.refusalDebugText(opName, status, reason, name);
    const err = INTERLOCK_REFUSAL_REASONS.has(reason)
      ? new RadioInterlockError(message)
      : new RadioProtocolError(message);
    err.debugText = debugText;
    return err;
  }

  private refusalDebugText(
    opName: string,
    status: number,
    reason: number,
    reasonName: string,
  ): string {
    const flagHex = this.info ? `0x${this.info.flags.toString(16).padStart(2, '0')}` : 'unknown';
    const writable = this.storageWritable();
    const writableLine = writable === null ? 'unknown' : writable ? 'yes' : 'no';
    const build = this.version;
    const buildLine = build
      ? `firmware: ${summariseRadioFoundryBuild(build).label}`
      : 'firmware: not reported';
    return [
      `op: ${opName}`,
      `status: ${status}`,
      `reason: ${reason} (${reasonName})`,
      `INFO flags: ${flagHex}, storage writable: ${writableLine}`,
      `board: ${this.board.label}`,
      buildLine,
    ].join('\n');
  }
}

export function createRadioFoundryCableProtocol(
  board: RadioFoundryCableBoard,
): RadioFoundryCableProtocol {
  return new RadioFoundryCableProtocol(board);
}

/** True for a session talking to any RadioFoundry board. The app uses this, not instanceof. */
export function isRadioFoundryCableRadio(radio: unknown): radio is RadioFoundryCableProtocol {
  return radio instanceof RadioFoundryCableProtocol;
}

function parseInfo(body: Uint8Array, board: RadioFoundryCableBoard): FastInfo {
  if (body.length < 26 || body[0] !== 1) throw new RadioProtocolError(HANDSHAKE_ERROR);
  const block = body[2]! | (body[3]! << 8);
  const sumsMax = body[4]!;
  const dataMax = body[5]!;
  const readMax = body[6]! | (body[7]! << 8);
  if (block !== BLOCK_SIZE || sumsMax < 1 || dataMax < 1 || readMax < 1) {
    throw new RadioProtocolError(HANDSHAKE_ERROR);
  }
  const eepromEnd = readU32(body, 8);
  const flashStart = readU32(body, 12);
  const imageEnd = readU32(body, 16);
  const physicalBase = readU32(body, 20);
  // The codec's file offsets assume this layout.
  if (
    eepromEnd !== EEPROM_IMAGE_END ||
    flashStart !== FLASH_IMAGE_START ||
    imageEnd <= EEPROM_IMAGE_END
  ) {
    throw new RadioProtocolError(HANDSHAKE_ERROR);
  }
  return {
    flags: body[1]!,
    sumsMax: Math.min(sumsMax, 16),
    dataChunk: Math.min(dataMax, DATA_CHUNK_MAX),
    readMax: Math.min(readMax, 1000),
    imageEnd: Math.min(imageEnd, board.limits.IMAGE_END),
    eepromEnd,
    flashStart,
    physicalBase,
  };
}

function codeplugOpName(op: number): string {
  return CODEPLUG_OP_NAMES[op] ?? `operation ${op}`;
}

function mergeBlock(radio: Uint8Array, addr: number, source: RadioFoundryWriteSource): Uint8Array {
  const want = radio.slice();
  if (addr >= DMR_ID_DATABASE_AREA2_ADDRESS) {
    const area2 = source.area2;
    const owned = source.area2Owned;
    if (!area2 || !owned) return want;
    const base = addr - DMR_ID_DATABASE_AREA2_ADDRESS;
    for (let i = 0; i < BLOCK_SIZE; i += 1) {
      const at = base + i;
      if (at < owned.length && owned[at]) want[i] = area2[at]!;
    }
    return want;
  }
  const n = Math.min(BLOCK_SIZE, source.bytes.length - addr);
  for (let i = 0; i < n; i += 1) {
    if (source.owned[addr + i]) want[i] = source.bytes[addr + i]!;
  }
  return want;
}

/** Refuses any block this write did not plan (served image blocks plus the ID-directory area-2 blocks it owns). */
export function assertPlannedWriteBlock(addr: number, planned: ReadonlySet<number>): void {
  if (!planned.has(addr)) {
    throw new RadioProtocolError(
      `Refusing codeplug block ${hex(addr)}: this write did not plan it. RadioFoundry writes use image offsets.`,
    );
  }
}

/**
 * Refuses a block outside the image: unaligned, or outside EEPROM, flash and ID-database area 2 (up to
 * the lower of INFO's image end and the board's). With `assertPlannedWriteBlock` it replaces a base
 * test: a physical address inside area 2 is sent only when it is an ID-directory block this write owns.
 */
export function assertImageBlock(
  addr: number,
  info: Pick<FastInfo, 'imageEnd' | 'eepromEnd' | 'flashStart'>,
  board: RadioFoundryCableBoard,
): void {
  if (!Number.isInteger(addr) || addr < 0) {
    throw new RadioProtocolError(
      `Refusing wire address ${hex(addr)}. RadioFoundry codeplug writes use image offsets.`,
    );
  }
  if (addr % BLOCK_SIZE !== 0) {
    throw new RadioProtocolError(`Codeplug block ${hex(addr)} is not 4 KB aligned.`);
  }
  const ceiling = Math.min(info.imageEnd, board.limits.IMAGE_END);
  const inEeprom = addr + BLOCK_SIZE <= info.eepromEnd;
  const inFlash = addr >= info.flashStart && addr < RADIOFOUNDRY_IMAGE_SIZE;
  const inArea2 = addr >= DMR_ID_DATABASE_AREA2_ADDRESS && addr + BLOCK_SIZE <= ceiling;
  if (!inEeprom && !inFlash && !inArea2) {
    throw new RadioProtocolError(
      `Codeplug block ${hex(addr)} is outside the image. RadioFoundry codeplug writes use image offsets.`,
    );
  }
}

function blankBlock(): Uint8Array {
  const block = new Uint8Array(BLOCK_SIZE);
  block.fill(0xff);
  return block;
}

function isBlank(block: Uint8Array): boolean {
  for (let i = 0; i < block.length; i += 1) if (block[i] !== 0xff) return false;
  return true;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function readU32(source: Uint8Array, offset: number): number {
  return (
    (source[offset]! |
      (source[offset + 1]! << 8) |
      (source[offset + 2]! << 16) |
      (source[offset + 3]! << 24)) >>>
    0
  );
}

function hex(addr: number): string {
  return `0x${(addr >>> 0).toString(16)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readFrame(pipe: BytePipe, timeoutMs: number): Promise<DebugFrame> {
  const started = Date.now();
  const remaining = (): number => {
    const left = timeoutMs - (Date.now() - started);
    if (left <= 0) throw new RadioTimeoutError();
    return left;
  };
  let prev = 0;
  for (;;) {
    const b = (await pipe.readExact(1, remaining()))[0]!;
    if (prev === 0xa5 && b === 0x5a) break;
    prev = b;
  }
  const head = await pipe.readExact(4, remaining());
  const len = head[2]! | (head[3]! << 8);
  if (len > 1024) throw new RadioProtocolError('RadioFoundry codeplug reply is too long.');
  const rest = await pipe.readExact(len + 2, remaining());
  const frame = new Uint8Array(8 + len);
  frame[0] = 0xa5;
  frame[1] = 0x5a;
  frame.set(head, 2);
  frame.set(rest, 6);
  try {
    return decodeDebugFrame(frame);
  } catch {
    throw new RadioProtocolError('RadioFoundry codeplug reply CRC does not match.');
  }
}
