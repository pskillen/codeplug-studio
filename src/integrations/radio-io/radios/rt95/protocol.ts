/**
 * RT95 VOX CloneImageRadio — PROGRAM→QX contiguous clone.
 */

import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  enterProgramQxMode,
  exitProgramQxMode,
  makeProgramQxReadFrame,
  makeProgramQxWriteFrame,
  parseProgramQxReadReply,
  parseProgramQxWriteAck,
  probeProgramQxIdent,
  PROGRAM_QX_BLOCK_SIZE,
  PROGRAM_QX_READ_REPLY_LEN,
  sendProgramQxCommand,
} from '../../kit/codecs/programQx.ts';
import { createMemoryMap, memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import {
  captureWriteVerifyStaging,
  type WriteVerifyStagingSnapshot,
} from '../../writeVerifyCompare.ts';
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

export interface Rt95ConnectOptions {
  signal?: AbortSignal;
  handshake?: 'read' | 'none';
}

export class Rt95Protocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;
  private radioBandlimit: number | null = null;
  private lastUploadStaging: WriteVerifyStagingSnapshot | undefined;

  async connect(pipe: BytePipe, opts?: Rt95ConnectOptions): Promise<IdentResult> {
    this.pipe = pipe;
    if (opts?.handshake !== 'none') {
      await flushPipe(pipe);
      await enterProgramQxMode(pipe, RT95_IO_TIMEOUT_MS);
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
    if (pipe) {
      try {
        await exitProgramQxMode(pipe);
      } catch {
        // best-effort
      }
    }
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

  private async writeBlock(pipe: BytePipe, addr: number, payload: Uint8Array): Promise<void> {
    const frame = makeProgramQxWriteFrame(addr, PROGRAM_QX_BLOCK_SIZE, payload);
    const ack = await sendProgramQxCommand(pipe, frame, 1, RT95_IO_TIMEOUT_MS);
    if (ack.length !== 1) {
      throw new RadioProtocolError(`RT95 write expected 1-byte ACK, got ${ack.length}`);
    }
    parseProgramQxWriteAck(ack[0]!);
  }

  async download(opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<MemoryMap> {
    const pipe = this.requirePipe();
    const image = createMemoryMap(RT95_IMAGE_SIZE);
    const blockCount = (RT95_BLOCK_ADDR_END - RT95_BLOCK_ADDR_START) / RT95_BLOCK_SIZE + 1;
    let done = 0;

    for (let addr = RT95_BLOCK_ADDR_START; addr <= RT95_BLOCK_ADDR_END; addr += RT95_BLOCK_SIZE) {
      throwIfAborted(opts.signal);
      const block = await this.readBlock(pipe, addr);
      image.set(addr, block);
      done += 1;
      reportProgress(
        opts.onProgress,
        { cur: done, max: blockCount, msg: `Reading 0x${addr.toString(16)}` },
        opts.signal,
      );
    }

    return image;
  }

  async upload(
    image: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    if (image.size < RT95_IMAGE_SIZE) {
      throw new RangeError(`Upload image must be at least 0x${RT95_IMAGE_SIZE.toString(16)} bytes`);
    }

    const pipe = this.requirePipe();
    const imageBandlimit = readBandlimitFromImage(image);
    if (this.radioBandlimit != null && imageBandlimit !== this.radioBandlimit) {
      // warn only — CHIRP continues upload with bandlimit mismatch
      console.warn(
        `RT95 image bandlimit 0x${imageBandlimit.toString(16)} differs from radio 0x${this.radioBandlimit.toString(16)}`,
      );
    }

    reportProgress(
      opts.onProgress,
      { cur: 0, max: RT95_IMAGE_SIZE / RT95_BLOCK_SIZE, msg: 'Upload handshake' },
      opts.signal,
    );

    await flushPipe(pipe);
    await enterProgramQxMode(pipe, RT95_IO_TIMEOUT_MS);
    const identRaw = await probeProgramQxIdent(pipe, RT95_IO_TIMEOUT_MS);
    const ident = parseRt95IdentResponse(identRaw);
    this.radioBandlimit = ident.bandlimit;

    const primeFrame = makeProgramQxReadFrame(RT95_UPLOAD_PRIME_ADDR, PROGRAM_QX_BLOCK_SIZE);
    await sendProgramQxCommand(pipe, primeFrame, PROGRAM_QX_READ_REPLY_LEN, RT95_IO_TIMEOUT_MS);

    const blockCount = (RT95_BLOCK_ADDR_END - RT95_BLOCK_ADDR_START) / RT95_BLOCK_SIZE + 1;
    let done = 0;
    const stagingChunks: { address: number; data: Uint8Array }[] = [];

    try {
      for (let addr = RT95_BLOCK_ADDR_START; addr <= RT95_BLOCK_ADDR_END; addr += RT95_BLOCK_SIZE) {
        throwIfAborted(opts.signal);
        const payload = image.get(addr, RT95_BLOCK_SIZE);
        await this.writeBlock(pipe, addr, payload);
        stagingChunks.push({ address: addr, data: payload.slice() });
        done += 1;
        reportProgress(
          opts.onProgress,
          { cur: done, max: blockCount, msg: `Writing 0x${addr.toString(16)}` },
          opts.signal,
        );
      }
      this.lastUploadStaging = captureWriteVerifyStaging(stagingChunks);
    } finally {
      await exitProgramQxMode(pipe);
    }
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
