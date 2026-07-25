/**
 * Read-only summary of a UV-21Pro V2 radio-clone hydration bag for build UI.
 */

import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { UV21_PRO_V2_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  summariseUv17ProClone,
  buildCloneRegionSummaries,
  type Uv17ProCloneSummary,
  type Uv17ProOnRadioCounts,
  type Uv17ProRetainGroupSummary,
  type RadioCloneRegionSummary,
} from '../uv17pro-family/cloneSummary.ts';

export type { RadioCloneRegionSummary };

export type Uv21ProV2OnRadioCounts = Uv17ProOnRadioCounts;
export type Uv21ProV2RetainGroupSummary = Uv17ProRetainGroupSummary;
export type Uv21ProV2CloneSummary = Uv17ProCloneSummary;

export const UV21_PRO_V2_CLONE_REGION_SUMMARIES: readonly RadioCloneRegionSummary[] =
  buildCloneRegionSummaries(UV21_PRO_V2_LAYOUT);

export function summariseUv21ProV2Clone(bag: RadioCloneHydrationBag): Uv21ProV2CloneSummary {
  return summariseUv17ProClone(UV21_PRO_V2_LAYOUT, bag);
}
