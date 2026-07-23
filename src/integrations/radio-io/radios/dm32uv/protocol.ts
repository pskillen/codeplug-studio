/**
 * DM-32UV CloneImageRadio — V-frame + 4KB sparse block download.
 * Cite: NeonPlug dm32uv/protocol.ts session flow (facts only).
 */

import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_METADATA,
  DM32_MODEL_IDS,
  DM32_VFRAME,
  DM32_VFRAME_QUERY_IDS,
} from './constants.ts';
import { decodeChannelsFromDm32Image, encodeChannelsIntoDm32Image } from './channelCodec.ts';
import {
  dm32AsciiHandshake,
  dm32EnterProgrammingMode,
  dm32QueryVFrame,
  dm32WriteMemory,
  parseConfigRangeFromV0a,
  parseFirmwareFromVFrames,
  type Dm32SettleOptions,
} from './connection.ts';
import {
  alignConfigEnd,
  bulkReadDm32Blocks,
  discoverDm32MemoryBlocks,
  readChannelCount,
  selectBlocksToBulkRead,
  type Dm32DiscoveredBlock,
} from './memory.ts';
import { parseDm32ContactsRange } from './contactCodec.ts';

/** Max MemoryMap span when folding contact bank into config window (bytes). */
const DM32_MAX_COMBINED_MAP_BYTES = 32 * 1024 * 1024;

export interface Dm32DownloadCache {
  addressBase: number;
  mapSize: number;
  firmware?: string;
  modelString?: string;
  discovered: Dm32DiscoveredBlock[];
  /** Absolute address → 4KB payload. */
  blocks: Map<number, Uint8Array>;
  /** V-frame 0x0F contact bank absolute start (when known). */
  contactsBase?: number;
  contactsEnd?: number;
}

function blocksToMemoryMap(cache: Dm32DownloadCache): MemoryMap {
  const map = createMemoryMap(cache.mapSize);
  map.fill(0, cache.mapSize, 0xff);
  for (const [addr, data] of cache.blocks) {
    const offset = addr - cache.addressBase;
    if (offset < 0 || offset + data.length > cache.mapSize) {
      throw new RangeError(
        `Block 0x${addr.toString(16)} out of MemoryMap window (base=0x${cache.addressBase.toString(16)}, size=${cache.mapSize})`,
      );
    }
    map.set(offset, data);
  }
  return map;
}

export function memoryMapToDm32Blocks(
  image: MemoryMap,
  addressBase: number,
  addresses: readonly number[],
): Map<number, Uint8Array> {
  const out = new Map<number, Uint8Array>();
  for (const addr of addresses) {
    const offset = addr - addressBase;
    out.set(addr, image.get(offset, DM32_BLOCK_SIZE).slice());
  }
  return out;
}

export class Dm32uvProtocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;
  private settle: Dm32SettleOptions = { settleScale: 1 };
  private cache: Dm32DownloadCache | null = null;
  private programming = false;

  /** Last successful download cache (for hydration / RMW). */
  getDownloadCache(): Dm32DownloadCache | null {
    return this.cache;
  }

  /**
   * Re-bind sparse block addresses from a prior Read hydration.
   * Required before upload when this session did not run download (typical
   * Write after remount / disconnect — connect alone leaves blocks empty).
   */
  seedDownloadCache(seed: Dm32DownloadCache): void {
    if (seed.blocks.size === 0) {
      throw new RadioProtocolError('DM-32UV hydration has no sparse blocks to write');
    }
    if (!this.cache) {
      this.cache = {
        addressBase: seed.addressBase,
        mapSize: seed.mapSize,
        firmware: seed.firmware,
        modelString: seed.modelString,
        discovered: seed.discovered.map((b) => ({ ...b })),
        blocks: new Map(seed.blocks),
        contactsBase: seed.contactsBase,
        contactsEnd: seed.contactsEnd,
      };
      return;
    }
    this.cache.addressBase = seed.addressBase;
    this.cache.mapSize = seed.mapSize;
    this.cache.firmware = seed.firmware ?? this.cache.firmware;
    this.cache.discovered = seed.discovered.map((b) => ({ ...b }));
    this.cache.blocks = new Map(seed.blocks);
    this.cache.contactsBase = seed.contactsBase;
    this.cache.contactsEnd = seed.contactsEnd;
  }

  async connect(
    pipe: BytePipe,
    opts?: { signal?: AbortSignal; settleScale?: number },
  ): Promise<IdentResult> {
    this.pipe = pipe;
    this.settle = { settleScale: opts?.settleScale ?? 1, signal: opts?.signal };
    this.cache = null;
    this.programming = false;

    const { modelString } = await dm32AsciiHandshake(pipe, this.settle);
    const vframes = new Map<number, Uint8Array>();
    for (const id of DM32_VFRAME_QUERY_IDS) {
      throwIfAborted(opts?.signal);
      try {
        const reply = await dm32QueryVFrame(pipe, id, this.settle);
        vframes.set(id, reply.payload);
      } catch {
        // NeonPlug continues when a single V-frame fails.
      }
    }

    const layoutPayload = vframes.get(DM32_VFRAME.MEMORY_LAYOUT);
    if (!layoutPayload) {
      throw new RadioProtocolError('DM-32UV missing V-frame 0x0A memory layout');
    }
    const range = parseConfigRangeFromV0a(layoutPayload);
    const addressBase = range.start;
    const alignedEnd = alignConfigEnd(range.end);
    const mapSize = alignedEnd - addressBase + DM32_BLOCK_SIZE;

    const contactsRange = parseDm32ContactsRange(
      vframes.get(DM32_VFRAME.CONTACTS) ?? new Uint8Array(),
    );

    this.cache = {
      addressBase,
      mapSize,
      firmware: parseFirmwareFromVFrames(vframes),
      modelString,
      discovered: [],
      blocks: new Map(),
      ...(contactsRange
        ? { contactsBase: contactsRange.start, contactsEnd: contactsRange.end }
        : {}),
    };

    await dm32EnterProgrammingMode(pipe, this.settle);
    this.programming = true;

    return {
      raw: new TextEncoder().encode(modelString),
      firmwareHint: this.cache.firmware,
      modelHints: [...DM32_MODEL_IDS],
    };
  }

  async disconnect(): Promise<void> {
    this.pipe = null;
    this.programming = false;
  }

  async download(opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<MemoryMap> {
    if (!this.pipe || !this.cache || !this.programming) {
      throw new RadioProtocolError('DM-32UV not connected / not in PROGRAM mode');
    }
    const settle = { ...this.settle, signal: opts.signal ?? this.settle.signal };

    reportProgress(
      opts.onProgress,
      { cur: 0, max: 100, msg: 'Discovering memory blocks' },
      opts.signal,
    );
    const discovered = await discoverDm32MemoryBlocks(
      this.pipe,
      this.cache.addressBase,
      this.cache.addressBase + this.cache.mapSize - 1,
      { ...settle, onProgress: opts.onProgress },
    );
    this.cache.discovered = discovered;

    const firstChannel = discovered.find((b) => b.metadata === DM32_METADATA.CHANNEL_FIRST);
    let channelCount = 0;
    if (firstChannel) {
      channelCount = await readChannelCount(this.pipe, firstChannel.address, settle);
    }

    const toRead = selectBlocksToBulkRead(discovered, channelCount);
    reportProgress(
      opts.onProgress,
      { cur: 0, max: toRead.length || 1, msg: `Bulk-reading ${toRead.length} blocks` },
      opts.signal,
    );
    this.cache.blocks = await bulkReadDm32Blocks(this.pipe, toRead, {
      ...settle,
      onProgress: opts.onProgress,
    });

    // Fold V-frame contact bank into sparse cache when it fits a reasonable MemoryMap window.
    if (
      this.cache.contactsBase != null &&
      this.cache.contactsEnd != null &&
      this.cache.contactsEnd > this.cache.contactsBase
    ) {
      const contactFirst = Math.floor(this.cache.contactsBase / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
      const contactLast = Math.floor(this.cache.contactsEnd / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
      const newBase = Math.min(this.cache.addressBase, contactFirst);
      const configLast = this.cache.addressBase + this.cache.mapSize - DM32_BLOCK_SIZE;
      const newLast = Math.max(configLast, contactLast);
      const combinedSize = newLast - newBase + DM32_BLOCK_SIZE;
      if (combinedSize > 0 && combinedSize <= DM32_MAX_COMBINED_MAP_BYTES) {
        const contactBlocks: Dm32DiscoveredBlock[] = [];
        for (let addr = contactFirst; addr <= contactLast; addr += DM32_BLOCK_SIZE) {
          contactBlocks.push({ address: addr, metadata: 0xff, type: 'unknown' });
        }
        const contactData = await bulkReadDm32Blocks(this.pipe, contactBlocks, {
          ...settle,
          onProgress: opts.onProgress,
        });
        for (const [addr, data] of contactData) {
          this.cache.blocks.set(addr, data);
        }
        this.cache.addressBase = newBase;
        this.cache.mapSize = combinedSize;
      }
    }

    return blocksToMemoryMap(this.cache);
  }

  async upload(
    image: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    if (!this.pipe || !this.cache) {
      throw new RadioProtocolError('DM-32UV not connected');
    }
    if (!this.programming) {
      await dm32EnterProgrammingMode(this.pipe, {
        ...this.settle,
        signal: opts.signal ?? this.settle.signal,
      });
      this.programming = true;
    }
    const addresses = [...this.cache.blocks.keys()].sort((a, b) => a - b);
    if (addresses.length === 0) {
      throw new RadioProtocolError(
        'DM-32UV upload has no sparse blocks — seed from a prior Read hydration before Write',
      );
    }
    const blocks = memoryMapToDm32Blocks(image, this.cache.addressBase, addresses);
    const total = addresses.length;
    for (let i = 0; i < addresses.length; i++) {
      throwIfAborted(opts.signal);
      const addr = addresses[i]!;
      const data = blocks.get(addr)!;
      reportProgress(
        opts.onProgress,
        { cur: i + 1, max: total, msg: `Writing block ${i + 1} of ${total}` },
        opts.signal,
      );
      await dm32WriteMemory(this.pipe, addr, data, {
        ...this.settle,
        signal: opts.signal ?? this.settle.signal,
      });
      this.cache.blocks.set(addr, data);
    }
  }

  decodeChannels(image: MemoryMap): RadioChannelDto[] {
    if (!this.cache) return [];
    return decodeChannelsFromDm32Image(image, this.cache);
  }

  encodeChannels(image: MemoryMap, channels: readonly RadioChannelDto[]): MemoryMap {
    if (!this.cache) return image;
    return encodeChannelsIntoDm32Image(image, this.cache, channels);
  }

  readFirmware(_image: MemoryMap): string | undefined {
    void _image;
    return this.cache?.firmware;
  }
}

export function createDm32uvProtocol(): CloneImageRadio {
  return new Dm32uvProtocol();
}
