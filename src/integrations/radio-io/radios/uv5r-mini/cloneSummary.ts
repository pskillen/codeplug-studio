/**
 * Read-only summary of a UV-5R Mini radio-clone hydration bag for build UI.
 */

import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  summariseUv17ProClone,
  buildCloneRegionSummaries,
  type Uv17ProCloneSummary,
  type Uv17ProOnRadioCounts,
  type Uv17ProRetainGroupSummary,
  type RadioCloneRegionSummary,
} from '../uv17pro-family/cloneSummary.ts';

export type { RadioCloneRegionSummary };

export type Uv5rMiniOnRadioCounts = Uv17ProOnRadioCounts;
export type Uv5rMiniRetainGroupSummary = Uv17ProRetainGroupSummary;
export type Uv5rMiniCloneSummary = Uv17ProCloneSummary;

export const UV5R_MINI_CLONE_REGION_SUMMARIES: readonly RadioCloneRegionSummary[] =
  buildCloneRegionSummaries(UV5R_MINI_LAYOUT);

export function summariseUv5rMiniClone(bag: RadioCloneHydrationBag): Uv5rMiniCloneSummary {
  return summariseUv17ProClone(UV5R_MINI_LAYOUT, bag);
}
