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
  DM32_CONNECTION,
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
  dm32ReadMemory,
  dm32WriteMemory,
  parseConfigRangeFromV0a,
  parseFirmwareFromVFrames,
  type Dm32SettleOptions,
} from './connection.ts';
import {
  alignConfigEnd,
  bulkReadDm32Blocks,
  classifyDm32Metadata,
  discoverDm32MemoryBlocks,
  dm32HydrationAddressMismatches,
  groupDm32BlocksForProgress,
  readChannelCount,
  readDm32BlockMetadataTags,
  selectBlocksToBulkRead,
  type Dm32DiscoveredBlock,
} from './memory.ts';
import {
  dm32MaxContactsFromFirmware,
  parseDm32ContactsRange,
  parseDm32MaxContacts,
  planDm32ContactBankBlocks,
  readDm32ContactCountFromBlock,
} from './contactCodec.ts';

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
  /** Max contacts from V-frame 0x10 or firmware fallback. */
  maxContacts?: number;
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
        maxContacts: seed.maxContacts,
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
    this.cache.maxContacts = seed.maxContacts;
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
    const firmware = parseFirmwareFromVFrames(vframes);
    const maxContacts =
      parseDm32MaxContacts(vframes.get(DM32_VFRAME.MAX_CONTACTS) ?? new Uint8Array()) ??
      dm32MaxContactsFromFirmware(firmware);

    this.cache = {
      addressBase,
      mapSize,
      firmware,
      modelString,
      discovered: [],
      blocks: new Map(),
      maxContacts,
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
      {
        cur: 0,
        max: 100,
        msg: 'Discovering memory map…',
        stage: 'Discover memory map',
      },
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
    const groups = groupDm32BlocksForProgress(toRead);
    this.cache.blocks = new Map();
    for (const group of groups) {
      reportProgress(
        opts.onProgress,
        {
          cur: 0,
          max: group.blocks.length || 1,
          msg: `Reading ${group.stage}…`,
          stage: group.stage,
        },
        opts.signal,
      );
      const part = await bulkReadDm32Blocks(this.pipe, group.blocks, {
        ...settle,
        onProgress: opts.onProgress,
        stage: group.stage,
      });
      for (const [addr, data] of part) {
        this.cache.blocks.set(addr, data);
      }
    }

    // Digital address-book (V-frame 0x0F) is intentionally not folded into the hydration
    // stash — L01 ranges are huge and often empty; modelled Write does not need RMW of
    // that bank today. Connect still records contactsBase/End/maxContacts. To pull the
    // bank later (NeonPlug readContacts), call {@link foldContactBankIntoDownloadCache}.

    return blocksToMemoryMap(this.cache);
  }

  /**
   * Future contacts Read: fold the V-frame 0x0F address book into the sparse cache by
   * header count (never walk the full L01 end span — that caused ~3464-block runaways).
   * Not invoked from {@link download}; kept for when hydration needs digital contacts.
   */
  async foldContactBankIntoDownloadCache(opts: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
  }): Promise<void> {
    if (!this.pipe || !this.cache || !this.programming) {
      throw new RadioProtocolError('DM-32UV not connected / not in PROGRAM mode');
    }
    if (
      this.cache.contactsBase == null ||
      this.cache.contactsEnd == null ||
      this.cache.contactsEnd <= this.cache.contactsBase
    ) {
      return;
    }
    const settle = { ...this.settle, signal: opts.signal ?? this.settle.signal };
    const contactsBase = this.cache.contactsBase;
    const firstBlockAddr = Math.floor(contactsBase / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
    reportProgress(
      opts.onProgress,
      { cur: 0, max: 1, msg: 'Reading contact bank header', stage: 'Digital contacts' },
      opts.signal,
    );
    const firstBlock = await dm32ReadMemory(this.pipe, firstBlockAddr, DM32_BLOCK_SIZE, settle);
    const countFromHeader = readDm32ContactCountFromBlock(
      firstBlock,
      contactsBase,
      firstBlockAddr,
    );
    const plan = planDm32ContactBankBlocks({
      contactsBase,
      contactsEnd: this.cache.contactsEnd,
      countFromHeader,
      maxContacts: this.cache.maxContacts ?? dm32MaxContactsFromFirmware(this.cache.firmware),
    });

    const contactBlocks: Dm32DiscoveredBlock[] = plan.blockAddresses.map((address) => ({
      address,
      metadata: 0xff,
      type: 'unknown' as const,
    }));
    const contactLast = plan.blockAddresses[plan.blockAddresses.length - 1]!;
    const newBase = Math.min(this.cache.addressBase, firstBlockAddr);
    const configLast = this.cache.addressBase + this.cache.mapSize - DM32_BLOCK_SIZE;
    const newLast = Math.max(configLast, contactLast);
    const combinedSize = newLast - newBase + DM32_BLOCK_SIZE;
    if (combinedSize <= 0 || combinedSize > DM32_MAX_COMBINED_MAP_BYTES) {
      return;
    }
    this.cache.blocks.set(firstBlockAddr, firstBlock);
    const remaining = contactBlocks.filter((b) => b.address !== firstBlockAddr);
    if (remaining.length > 0) {
      const contactData = await bulkReadDm32Blocks(this.pipe, remaining, {
        ...settle,
        onProgress: opts.onProgress,
        stage: 'Digital contacts',
      });
      for (const [addr, data] of contactData) {
        this.cache.blocks.set(addr, data);
      }
    }
    this.cache.addressBase = newBase;
    this.cache.mapSize = combinedSize;
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

    // Stale hydration after factory reset / CPS rewrite writes to the wrong absolute
    // addresses (ZONE/VFO/channel banks move). Verify tags before any Write.
    reportProgress(
      opts.onProgress,
      {
        cur: 0,
        max: addresses.length || 1,
        msg: 'Checking radio memory map…',
        stage: 'Verify memory map',
      },
      opts.signal,
    );
    const expected = addresses.map((address) => {
      const known = this.cache!.discovered.find((b) => b.address === address);
      const data = this.cache!.blocks.get(address);
      const metadata = known?.metadata ?? data?.[DM32_BLOCK_SIZE - 1] ?? 0xff;
      return { address, metadata };
    });
    const live = await readDm32BlockMetadataTags(this.pipe, addresses, {
      ...this.settle,
      signal: opts.signal ?? this.settle.signal,
    });
    const mismatches = dm32HydrationAddressMismatches(expected, live);
    if (mismatches.length > 0) {
      const sample = mismatches
        .slice(0, 3)
        .map(
          (m) =>
            `0x${m.address.toString(16)} expected 0x${m.expected.toString(16)}, radio has 0x${m.live.toString(16)}`,
        )
        .join('; ');
      throw new RadioProtocolError(
        `Radio memory map changed since the last Read (common after a factory reset). ${sample}. Read from the radio again on this egress, then Write.`,
      );
    }

    const blocks = memoryMapToDm32Blocks(image, this.cache.addressBase, addresses);
    const byAddr = new Map(this.cache.discovered.map((b) => [b.address, b]));
    const discoveredForProgress: Dm32DiscoveredBlock[] = addresses.map((address) => {
      const known = byAddr.get(address);
      const data = blocks.get(address) ?? this.cache!.blocks.get(address);
      const metadata = data?.[DM32_BLOCK_SIZE - 1] ?? known?.metadata ?? 0xff;
      const type = classifyDm32Metadata(metadata);
      // Prefer live metadata from the image we are about to write (hydration seed may
      // have carried type:'unknown' from older bags).
      if (known && known.metadata === metadata && known.type === type) return known;
      return { address, metadata, type };
    });
    const groups = groupDm32BlocksForProgress(discoveredForProgress);
    const settle = { ...this.settle, signal: opts.signal ?? this.settle.signal };
    const scale = settle.settleScale ?? 1;
    const interBlockMs = scale <= 0 ? 0 : DM32_CONNECTION.BLOCK_READ_DELAY_MS * scale;

    // Seed the progress checklist with every bank before the first write so Channels
    // is visible even while later groups are still pending.
    for (const group of groups) {
      reportProgress(
        opts.onProgress,
        {
          cur: 0,
          max: group.blocks.length || 1,
          msg: `Queued ${group.stage} (${group.blocks.length} block${group.blocks.length === 1 ? '' : 's'})`,
          stage: group.stage,
        },
        opts.signal,
      );
    }

    for (const group of groups) {
      reportProgress(
        opts.onProgress,
        {
          cur: 0,
          max: group.blocks.length || 1,
          msg: `Writing ${group.stage}…`,
          stage: group.stage,
        },
        opts.signal,
      );
      for (let i = 0; i < group.blocks.length; i++) {
        throwIfAborted(opts.signal);
        if (interBlockMs > 0) {
          await new Promise((r) => setTimeout(r, interBlockMs));
        }
        const addr = group.blocks[i]!.address;
        const data = blocks.get(addr)!;
        reportProgress(
          opts.onProgress,
          {
            cur: i + 1,
            max: group.blocks.length,
            msg: `Writing ${group.stage}: block ${i + 1} of ${group.blocks.length} (0x${addr.toString(16)})`,
            stage: group.stage,
          },
          opts.signal,
        );
        await dm32WriteMemory(this.pipe, addr, data, settle);
        this.cache.blocks.set(addr, data);
      }
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
