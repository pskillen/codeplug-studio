/**
 * Read-only summary of a UV-17Pro family radio-clone hydration bag for build UI.
 */

import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { radioCloneImageBytes } from '@core/models/radioCloneHydration.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import type { Uv17ProLayout } from './layout.ts';
import { decodeChannelsFromImage, readFirmwareFromImage } from './channelCodec.ts';
import {
  UV17PRO_WRITTEN_FROM_BUILD_LABELS,
  buildUv17ProRegionManifest,
  uv17ProKeptRegions,
} from './writeRole.ts';
import {
  ancillaryRetainPreview,
  settingsRetainPreview,
  type Uv17ProAncillaryRetainPreview,
  type Uv17ProRetainPreviewRow,
} from './retainPreview.ts';
import { inspectOccupiedChannels, type CloneInspectNamedItem } from '../../cloneInspect.ts';

export interface RadioCloneRegionSummary {
  label: string;
  packedOffset: number;
  sizeBytes: number;
  role: string;
}

export interface Uv17ProOnRadioCounts {
  occupiedChannels: number;
  emptyChannelSlots: number;
}

export interface Uv17ProRetainGroupSummary {
  label: string;
  regionCount: number;
  role: string;
}

export interface Uv17ProCloneSummary {
  radioModelId: string;
  firmware?: string;
  imageByteLength: number;
  capturedVia: RadioCloneHydrationBag['retain']['capturedVia'];
  onRadioCounts: Uv17ProOnRadioCounts;
  writtenFromBuild: readonly string[];
  retainGroups: readonly Uv17ProRetainGroupSummary[];
  settingsRetain: readonly Uv17ProRetainPreviewRow[];
  ancillaryRetain: Uv17ProAncillaryRetainPreview;
  inspectChannels: readonly CloneInspectNamedItem[];
}

export function buildCloneRegionSummaries(
  layout: Uv17ProLayout,
): readonly RadioCloneRegionSummary[] {
  return buildUv17ProRegionManifest(layout).map((r) => ({
    label: r.label,
    packedOffset: r.packedOffset,
    sizeBytes: r.sizeBytes,
    role: r.retainRoleCopy,
  }));
}

export function summariseUv17ProClone(
  layout: Uv17ProLayout,
  bag: RadioCloneHydrationBag,
): Uv17ProCloneSummary {
  const bytes = radioCloneImageBytes(bag);
  const image = memoryMapFromBytes(bytes);
  const channels = decodeChannelsFromImage(layout, image);
  const occupied = channels.filter((c) => !c.empty).length;
  const firmware = bag.retain.firmware ?? readFirmwareFromImage(layout, image);

  return {
    radioModelId: bag.retain.radioModelId,
    firmware,
    imageByteLength: bag.retain.imageByteLength,
    capturedVia: bag.retain.capturedVia,
    onRadioCounts: {
      occupiedChannels: occupied,
      emptyChannelSlots: layout.channelCount - occupied,
    },
    writtenFromBuild: [...UV17PRO_WRITTEN_FROM_BUILD_LABELS],
    retainGroups: uv17ProKeptRegions(layout).map((r) => ({
      label: r.label,
      regionCount: 1,
      role: r.retainRoleCopy,
    })),
    settingsRetain: settingsRetainPreview(layout, bytes),
    ancillaryRetain: ancillaryRetainPreview(layout, bytes),
    inspectChannels: inspectOccupiedChannels(channels),
  };
}
