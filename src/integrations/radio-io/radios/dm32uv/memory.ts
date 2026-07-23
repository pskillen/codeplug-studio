/**
 * DM-32UV sparse 4KB block discovery and bulk-read selection.
 * Cite: NeonPlug dm32uv/memory.ts + protocol bulkReadRequiredBlocks (facts only).
 */

import type { BytePipe, ProgressFn } from '../../types.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_CONNECTION,
  DM32_LIMITS,
  DM32_METADATA,
  DM32_METADATA_OFFSET,
  DM32_OFFSET,
  DM32_REQUIRED_METADATA,
} from './constants.ts';
import { dm32ReadMemory, type Dm32SettleOptions } from './connection.ts';

export type Dm32BlockType =
  | 'channel'
  | 'zone'
  | 'scan'
  | 'vfo'
  | 'digitalemergency'
  | 'analogemergency'
  | 'message'
  | 'calibration'
  | 'rxgroup'
  | 'dmrradioid'
  | 'config'
  | 'empty'
  | 'unknown';

export interface Dm32DiscoveredBlock {
  address: number;
  metadata: number;
  type: Dm32BlockType;
}

export function classifyDm32Metadata(metadata: number): Dm32BlockType {
  if (metadata === DM32_METADATA.EMPTY || metadata === DM32_METADATA.EMPTY_ALT) return 'empty';
  if (metadata >= DM32_METADATA.CHANNEL_FIRST && metadata <= DM32_METADATA.CHANNEL_LAST) {
    return 'channel';
  }
  if (metadata === DM32_METADATA.ZONE) return 'zone';
  if (metadata === DM32_METADATA.SCAN_LIST) return 'scan';
  if (metadata === 0x03) return 'digitalemergency'; // discovery path (see tier-3 inconsistency note)
  if (metadata === DM32_METADATA.VFO_SETTINGS) return 'vfo';
  if (metadata === DM32_METADATA.ANALOG_EMERGENCY) return 'analogemergency';
  if (metadata === DM32_METADATA.QUICK_MESSAGES) return 'message';
  if (metadata === DM32_METADATA.CALIBRATION) return 'calibration';
  if (metadata === DM32_METADATA.RX_GROUPS) return 'rxgroup';
  if (metadata === DM32_METADATA.DMR_RADIO_IDS) return 'dmrradioid';
  if (metadata === DM32_METADATA.CONFIG_TG_COUNTER) return 'config';
  return 'unknown';
}

export function alignConfigEnd(endAddr: number): number {
  return Math.floor(endAddr / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
}

export async function discoverDm32MemoryBlocks(
  pipe: BytePipe,
  startAddr: number,
  endAddr: number,
  opts?: Dm32SettleOptions & { onProgress?: ProgressFn },
): Promise<Dm32DiscoveredBlock[]> {
  const alignedEnd = alignConfigEnd(endAddr);
  const blockCount = Math.floor((alignedEnd - startAddr) / DM32_BLOCK_SIZE) + 1;
  const blocks: Dm32DiscoveredBlock[] = [];
  let index = 0;
  for (let addr = startAddr; addr <= alignedEnd; addr += DM32_BLOCK_SIZE) {
    throwIfAborted(opts?.signal);
    const metaByte = await dm32ReadMemory(pipe, addr + DM32_METADATA_OFFSET, 1, opts);
    const metadata = metaByte[0] ?? 0;
    blocks.push({ address: addr, metadata, type: classifyDm32Metadata(metadata) });
    index += 1;
    if (index % 10 === 0 || index === blockCount) {
      reportProgress(
        opts?.onProgress,
        { cur: index, max: blockCount, msg: `Reading metadata ${index} of ${blockCount}` },
        opts?.signal,
      );
    }
    if (index < blockCount) {
      const scale = opts?.settleScale ?? 1;
      if (scale > 0) {
        await new Promise((r) => setTimeout(r, DM32_CONNECTION.METADATA_SCAN_DELAY_MS * scale));
      }
    }
  }
  return blocks;
}

export function channelBlocksNeeded(
  channelBlocks: Dm32DiscoveredBlock[],
  channelCount: number,
): Dm32DiscoveredBlock[] {
  const sorted = [...channelBlocks].sort((a, b) => a.metadata - b.metadata);
  const first = DM32_LIMITS.CHANNELS_IN_FIRST_BLOCK;
  const later = DM32_LIMITS.CHANNELS_PER_LATER_BLOCK;
  let blocksNeeded: number;
  if (channelCount <= first) {
    blocksNeeded = 1;
  } else {
    const remaining = channelCount - first;
    blocksNeeded = 1 + Math.ceil(remaining / later) + 1; // +1 safety like NeonPlug
  }
  blocksNeeded = Math.min(blocksNeeded, sorted.length);
  return sorted.slice(0, blocksNeeded);
}

export function selectBlocksToBulkRead(
  discovered: readonly Dm32DiscoveredBlock[],
  channelCount: number,
): Dm32DiscoveredBlock[] {
  const selected: Dm32DiscoveredBlock[] = [];
  const seen = new Set<number>();

  const push = (block: Dm32DiscoveredBlock): void => {
    if (seen.has(block.address)) return;
    seen.add(block.address);
    selected.push(block);
  };

  const channelBlocks = discovered.filter((b) => b.type === 'channel');
  for (const b of channelBlocksNeeded(channelBlocks, channelCount)) {
    push(b);
  }

  for (const metadata of DM32_REQUIRED_METADATA) {
    const block = discovered.find((b) => b.metadata === metadata);
    if (block) push(block);
  }

  for (const b of discovered) {
    if (
      b.type === 'zone' ||
      b.type === 'scan' ||
      b.type === 'message' ||
      b.type === 'dmrradioid' ||
      b.type === 'rxgroup'
    ) {
      push(b);
    }
  }

  return selected;
}

export async function readChannelCount(
  pipe: BytePipe,
  firstChannelBlockAddr: number,
  opts?: Dm32SettleOptions,
): Promise<number> {
  const data = await dm32ReadMemory(pipe, firstChannelBlockAddr + DM32_OFFSET.CHANNEL_COUNT, 2, opts);
  return data[0]! | (data[1]! << 8);
}

export async function bulkReadDm32Blocks(
  pipe: BytePipe,
  blocks: readonly Dm32DiscoveredBlock[],
  opts?: Dm32SettleOptions & { onProgress?: ProgressFn },
): Promise<Map<number, Uint8Array>> {
  const out = new Map<number, Uint8Array>();
  const total = blocks.length;
  for (let i = 0; i < blocks.length; i++) {
    throwIfAborted(opts?.signal);
    const block = blocks[i]!;
    reportProgress(
      opts?.onProgress,
      {
        cur: i + 1,
        max: total,
        msg: `Reading block ${i + 1} of ${total} (0x${block.address.toString(16)})`,
      },
      opts?.signal,
    );
    const data = await dm32ReadMemory(pipe, block.address, DM32_BLOCK_SIZE, opts);
    out.set(block.address, data);
  }
  return out;
}
