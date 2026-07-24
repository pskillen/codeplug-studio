/**
 * Read-only summary of a DM-32UV sparse radio-clone hydration bag.
 */

import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import {
  radioCloneHasSparseBlocks,
  radioCloneSparseBlockBytes,
} from '@core/models/radioCloneHydration.ts';
import { decodeChannelsFromDm32Image } from './channelCodec.ts';
import { memoryMapFromDm32uvHydration } from './hydration.ts';
import { classifyDm32Metadata } from './memory.ts';
import { DM32_METADATA, DM32_METADATA_OFFSET, DM32_REQUIRED_METADATA } from './constants.ts';
import {
  aggregateOnRadioCounts,
  type Dm32OnRadioCounts,
  type Dm32SparseBlockInput,
} from './retainCounts.ts';
import {
  ancillaryRetainPreview,
  settingsRetainPreview,
  type Dm32AncillaryRetainPreview,
  type Dm32RetainPreviewRow,
} from './retainPreview.ts';
import {
  dm32BlockLabel,
  dm32ChannelBankAddresses,
  dm32WriteRole,
  DM32_ANALOG_CONTACTS_WRITE_GAP,
  DM32_WRITTEN_FROM_BUILD_LABELS,
} from './writeRole.ts';

export interface Dm32RetainGroupSummary {
  label: string;
  blockCount: number;
  role: string;
}

export interface Dm32RequiredBlockStatus {
  label: string;
  present: boolean;
}

export interface Dm32uvCloneSummary {
  radioModelId: string;
  firmware?: string;
  imageByteLength: number;
  capturedVia: RadioCloneHydrationBag['retain']['capturedVia'];
  onRadioCounts: Dm32OnRadioCounts;
  writtenFromBuild: readonly string[];
  /** Styleguide-compliant note that analog contacts are not written. */
  analogContactsWriteGap: string;
  retainGroups: readonly Dm32RetainGroupSummary[];
  settingsRetain: readonly Dm32RetainPreviewRow[];
  ancillaryRetain: Dm32AncillaryRetainPreview;
  requiredBlocks: readonly Dm32RequiredBlockStatus[];
  blockCount: number;
}

function requiredBlockLabel(metadata: number): string {
  return dm32BlockLabel(metadata, classifyDm32Metadata(metadata));
}

function retainRoleCopy(): string {
  return 'Kept from Read from radio — not changed when you write from your build';
}

function groupRetainBlocks(
  blocks: readonly Dm32SparseBlockInput[],
  channelBankAddresses: ReadonlySet<number>,
): Dm32RetainGroupSummary[] {
  const groups = new Map<string, { count: number; role: string }>();

  for (const b of blocks) {
    const type = classifyDm32Metadata(b.metadata);
    if (type === 'empty') continue;
    const role = dm32WriteRole(b.metadata, type, {
      address: b.address,
      channelBankAddresses,
    });
    if (role === 'replaced') continue;

    const label = dm32BlockLabel(b.metadata, type);
    const existing = groups.get(label);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(label, { count: 1, role: retainRoleCopy() });
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, { count, role }]) => ({
      label,
      blockCount: count,
      role,
    }));
}

function findSettingsBlock(blocks: readonly Dm32SparseBlockInput[]): Uint8Array | null {
  const hit = blocks.find(
    (b) => b.metadata === DM32_METADATA.VFO_SETTINGS || classifyDm32Metadata(b.metadata) === 'vfo',
  );
  return hit?.data ?? null;
}

export function summariseDm32uvClone(bag: RadioCloneHydrationBag): Dm32uvCloneSummary {
  const image = memoryMapFromDm32uvHydration(bag);
  const addressBase = bag.retain.addressBase ?? 0;
  const sparse = radioCloneSparseBlockBytes(bag);
  const blockInputs: Dm32SparseBlockInput[] = sparse.map((b) => {
    const metadata = b.data[DM32_METADATA_OFFSET] ?? 0;
    return {
      address: b.address,
      data: b.data,
      metadata,
      type: classifyDm32Metadata(metadata),
    };
  });
  const discovered = blockInputs.map((b) => ({ address: b.address, metadata: b.metadata }));
  const channels = decodeChannelsFromDm32Image(image, { addressBase, discovered });
  const occupied = channels.filter((c) => !c.empty).length;
  const firstBlock = blockInputs.find((b) => b.metadata === DM32_METADATA.CHANNEL_FIRST);
  let totalSlots = channels.length;
  if (firstBlock) {
    totalSlots = firstBlock.data[0]! | (firstBlock.data[1]! << 8);
  }

  const channelBankAddresses = dm32ChannelBankAddresses(discovered, totalSlots);
  const onRadioCounts = aggregateOnRadioCounts(blockInputs, occupied, totalSlots);
  const settingsBlock = findSettingsBlock(blockInputs);

  const requiredBlocks: Dm32RequiredBlockStatus[] = DM32_REQUIRED_METADATA.map((metadata) => ({
    label: requiredBlockLabel(metadata),
    present: blockInputs.some((b) => b.metadata === metadata),
  }));

  return {
    radioModelId: bag.retain.radioModelId,
    firmware: bag.retain.firmware,
    imageByteLength: bag.retain.imageByteLength,
    capturedVia: bag.retain.capturedVia,
    onRadioCounts,
    writtenFromBuild: [...DM32_WRITTEN_FROM_BUILD_LABELS],
    analogContactsWriteGap: DM32_ANALOG_CONTACTS_WRITE_GAP,
    retainGroups: groupRetainBlocks(blockInputs, channelBankAddresses),
    settingsRetain: settingsBlock ? settingsRetainPreview(settingsBlock) : [],
    ancillaryRetain: ancillaryRetainPreview(blockInputs),
    requiredBlocks,
    blockCount: radioCloneHasSparseBlocks(bag) ? sparse.length : 0,
  };
}

// Legacy shape for tests that imported regions — remove if unused
export type { Dm32RetainPreviewRow };
