/**
 * AT-D890UV CloneImageRadio — sparse 16-byte selective download/upload.
 */

import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  AT_D890_LIMITS,
  AT_D890_SAFE_SKIP_WRITE_ADDR,
  D890_MAP,
} from './constants.ts';
import {
  atD890EnterProgram,
  atD890ProbeIdent,
  atD890ReadMemory,
  atD890WriteMemory,
  atD890ModelHints,
} from './connection.ts';
import { listSetBits } from './bitmap.ts';
import {
  applyAtD890WriteImageToCache,
  cacheToMemoryMap,
  channelPrimaryAddress,
  channelSecondaryAddress,
  putCacheBytes,
  listWriteChunks,
  zoneChannelsAddress,
  zoneNameAddress,
  scanListAddress,
  talkgroupAddress,
  receiveGroupAddress,
  radioIdAddress,
  alignAtD890ReadLength,
  type AtD890DownloadCache,
} from './memory.ts';
import {
  decodeChannelsFromAtD890Cache,
  encodeChannelsIntoAtD890Image,
} from './channelCodec.ts';

export type { AtD890DownloadCache };

const DOWNLOAD_STAGES = [
  'Local info',
  'Channels',
  'Zones',
  'Scan lists',
  'Talk groups',
  'RX groups',
  'Radio IDs',
  'Master ID',
] as const;

async function readRegion(
  pipe: BytePipe,
  cache: AtD890DownloadCache,
  address: number,
  length: number,
  signal?: AbortSignal,
): Promise<void> {
  const data = await atD890ReadMemory(pipe, address, length, signal);
  putCacheBytes(cache, address, data);
}

export async function downloadAtD890SparseRegions(
  pipe: BytePipe,
  cache: AtD890DownloadCache,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<void> {
  const signal = opts?.signal;
  let stageIdx = 0;
  const stage = (msg: string) => {
    reportProgress(
      opts?.onProgress,
      { cur: stageIdx, max: DOWNLOAD_STAGES.length, msg, stage: DOWNLOAD_STAGES[stageIdx] },
      signal,
    );
    stageIdx += 1;
  };

  stage('Reading local info…');
  await readRegion(pipe, cache, D890_MAP.LocalInfo, D890_MAP.LocalInfoLength, signal);

  stage('Reading channel bitmap…');
  await readRegion(pipe, cache, D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES, signal);
  const channelSet = cache.blocks.get(D890_MAP.ChannelSet)!;
  for (const idx of listSetBits(channelSet)) {
    throwIfAborted(signal);
    const primary = await atD890ReadMemory(
      pipe,
      channelPrimaryAddress(idx),
      AT_D890_LIMITS.CHANNEL_CHUNK_SIZE,
      signal,
    );
    putCacheBytes(cache, channelPrimaryAddress(idx), primary);
    const secondary = await atD890ReadMemory(
      pipe,
      channelSecondaryAddress(idx),
      AT_D890_LIMITS.CHANNEL_CHUNK_SIZE,
      signal,
    );
    putCacheBytes(cache, channelSecondaryAddress(idx), secondary);
  }

  stage('Reading zones…');
  await readRegion(pipe, cache, D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES, signal);
  await readRegion(pipe, cache, D890_MAP.ZoneHide, AT_D890_LIMITS.ZONE_SET_BYTES, signal);
  await readRegion(pipe, cache, D890_MAP.ZoneAChannel, D890_MAP.ZoneTableBytes, signal);
  await readRegion(pipe, cache, D890_MAP.ZoneBChannel, D890_MAP.ZoneTableBytes, signal);
  const zoneSet = cache.blocks.get(D890_MAP.ZoneSet)!;
  for (const idx of listSetBits(zoneSet)) {
    throwIfAborted(signal);
    await readRegion(pipe, cache, zoneNameAddress(idx), D890_MAP.ZoneDataLength, signal);
    await readRegion(pipe, cache, zoneChannelsAddress(idx), D890_MAP.ZoneChannelsStride, signal);
  }

  stage('Reading scan lists…');
  await readRegion(pipe, cache, D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES, signal);
  const scanSet = cache.blocks.get(D890_MAP.ScanListSet)!;
  for (const idx of listSetBits(scanSet)) {
    throwIfAborted(signal);
    await readRegion(
      pipe,
      cache,
      scanListAddress(idx),
      AT_D890_LIMITS.SCAN_LIST_STRIDE,
      signal,
    );
  }

  stage('Reading talk groups…');
  await readRegion(pipe, cache, D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES, signal);
  const tgSet = cache.blocks.get(D890_MAP.TalkgroupSet)!;
  for (const idx of listSetBits(tgSet, true)) {
    throwIfAborted(signal);
    await readRegion(
      pipe,
      cache,
      talkgroupAddress(idx),
      alignAtD890ReadLength(AT_D890_LIMITS.TALKGROUP_STRIDE),
      signal,
    );
  }

  stage('Reading RX groups…');
  await readRegion(pipe, cache, D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES, signal);
  const rxSet = cache.blocks.get(D890_MAP.ReceiveGroupSet)!;
  for (const idx of listSetBits(rxSet)) {
    throwIfAborted(signal);
    await readRegion(
      pipe,
      cache,
      receiveGroupAddress(idx),
      AT_D890_LIMITS.RX_GROUP_STRIDE,
      signal,
    );
  }

  stage('Reading operator radio IDs…');
  await readRegion(pipe, cache, D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES, signal);
  const ridSet = cache.blocks.get(D890_MAP.RadioIdSet)!;
  for (const idx of listSetBits(ridSet)) {
    throwIfAborted(signal);
    await readRegion(pipe, cache, radioIdAddress(idx), AT_D890_LIMITS.RADIO_ID_STRIDE, signal);
  }

  stage('Reading master radio ID…');
  await readRegion(pipe, cache, D890_MAP.MasterIdData, D890_MAP.MasterIdLength, signal);
}

export class AtD890uvProtocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;
  private cache: AtD890DownloadCache | null = null;
  private programming = false;

  getDownloadCache(): AtD890DownloadCache | null {
    return this.cache;
  }

  seedDownloadCache(seed: AtD890DownloadCache): void {
    if (seed.blocks.size === 0) {
      throw new RadioProtocolError('AT-D890UV hydration has no sparse blocks to write');
    }
    if (!this.cache) {
      this.cache = {
        firmware: seed.firmware,
        modelString: seed.modelString,
        blocks: new Map(seed.blocks),
      };
      return;
    }
    this.cache.firmware = seed.firmware ?? this.cache.firmware;
    this.cache.modelString = seed.modelString ?? this.cache.modelString;
    this.cache.blocks = new Map(seed.blocks);
  }

  async connect(
    pipe: BytePipe,
    opts?: { signal?: AbortSignal; settleScale?: number },
  ): Promise<IdentResult> {
    void opts?.settleScale;
    this.pipe = pipe;
    this.cache = { blocks: new Map() };
    this.programming = false;

    await atD890EnterProgram(pipe, opts?.signal);
    this.programming = true;
    const ident = await atD890ProbeIdent(pipe, opts?.signal);
    this.cache.modelString = ident.model;
    this.cache.firmware = ident.version;

    return {
      raw: ident.raw,
      firmwareHint: ident.version,
      modelHints: [...atD890ModelHints()],
    };
  }

  async disconnect(): Promise<void> {
    this.pipe = null;
    this.programming = false;
  }

  async download(opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<MemoryMap> {
    if (!this.pipe || !this.cache || !this.programming) {
      throw new RadioProtocolError('AT-D890UV not connected / not in PROGRAM mode');
    }
    this.cache.blocks = new Map();
    await downloadAtD890SparseRegions(this.pipe, this.cache, opts);
    return cacheToMemoryMap(this.cache);
  }

  async upload(
    image: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    if (!this.pipe || !this.cache) {
      throw new RadioProtocolError('AT-D890UV not connected');
    }
    if (!this.programming) {
      await atD890EnterProgram(this.pipe, opts.signal);
      this.programming = true;
    }
    if (this.cache.blocks.size === 0) {
      throw new RadioProtocolError(
        'AT-D890UV upload has no sparse blocks — seed from a prior Read hydration before Write',
      );
    }

    applyAtD890WriteImageToCache(this.cache, image);

    const chunks = listWriteChunks(this.cache, AT_D890_SAFE_SKIP_WRITE_ADDR);
    reportProgress(
      opts.onProgress,
      { cur: 0, max: chunks.length || 1, msg: 'Writing sparse regions…', stage: 'Upload' },
      opts.signal,
    );

    for (let i = 0; i < chunks.length; i++) {
      throwIfAborted(opts.signal);
      const { address, data } = chunks[i]!;
      if (address === AT_D890_SAFE_SKIP_WRITE_ADDR) continue;
      reportProgress(
        opts.onProgress,
        {
          cur: i + 1,
          max: chunks.length,
          msg: `Writing 0x${address.toString(16)}`,
          stage: 'Upload',
        },
        opts.signal,
      );
      await atD890WriteMemory(this.pipe, address, data, opts.signal);
      putCacheBytes(this.cache, address, data);
    }
  }

  decodeChannels(_image: MemoryMap): RadioChannelDto[] {
    if (!this.cache) return [];
    return decodeChannelsFromAtD890Cache(this.cache);
  }

  encodeChannels(image: MemoryMap, channels: readonly RadioChannelDto[]): MemoryMap {
    return encodeChannelsIntoAtD890Image(image, channels);
  }

  readFirmware(image: MemoryMap): string | undefined {
    void image;
    return this.cache?.firmware;
  }
}

export function createAtD890uvProtocol(): CloneImageRadio {
  return new AtD890uvProtocol();
}
