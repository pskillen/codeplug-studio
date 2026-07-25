/**
 * Read-only summary of an RT95 radio-clone hydration bag for build UI.
 */

import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { radioCloneImageBytes } from '@core/models/radioCloneHydration.ts';
import { countOccupiedFromBitfield } from './bitfield.ts';
import { RT95_MODEL_ID } from './constants.ts';
import {
  RT95_WRITTEN_FROM_BUILD_LABELS,
  rt95KeptRegions,
  type Rt95RegionManifestEntry,
} from './writeRole.ts';
import { settingsRetainPreview, type Rt95RetainPreviewRow } from './retainPreview.ts';

export interface Rt95RetainGroupSummary {
  label: string;
  role: string;
}

export interface Rt95CloneSummary {
  radioModelId: string;
  imageByteLength: number;
  capturedVia: RadioCloneHydrationBag['retain']['capturedVia'];
  occupiedChannelCount: number;
  emptyChannelCount: number;
  writtenFromBuild: readonly string[];
  retainGroups: readonly Rt95RetainGroupSummary[];
  settingsRetain: readonly Rt95RetainPreviewRow[];
}

export function summariseRt95Clone(bag: RadioCloneHydrationBag): Rt95CloneSummary | null {
  if (bag.retain.radioModelId !== RT95_MODEL_ID) return null;
  const bytes = radioCloneImageBytes(bag);
  const occupied = countOccupiedFromBitfield(bytes);
  const kept = rt95KeptRegions();

  return {
    radioModelId: bag.retain.radioModelId,
    imageByteLength: bag.retain.imageByteLength,
    capturedVia: bag.retain.capturedVia,
    occupiedChannelCount: occupied,
    emptyChannelCount: 200 - occupied,
    writtenFromBuild: RT95_WRITTEN_FROM_BUILD_LABELS,
    retainGroups: kept.map((r: Rt95RegionManifestEntry) => ({
      label: r.label,
      role: 'Kept from Read from radio — not changed when you write from your build',
    })),
    settingsRetain: settingsRetainPreview(bytes),
  };
}
