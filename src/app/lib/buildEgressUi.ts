import type { EgressPath } from '@core/models/egressPath.ts';
import { isRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { defaultCompatibleEgress } from '@core/radio-targets/index.ts';
import { isNeonplugDonorBag } from '../services/buildCpsExportService.ts';

export interface EgressIdentity {
  formatId: string;
  profileId: string;
}

/** Active egress when in build layout; otherwise the catalog default for the radio target. */
export function egressIdentityForBuild(
  build: RadioBuild,
  activeEgress?: EgressPath | null,
): EgressIdentity {
  if (activeEgress && activeEgress.radioBuildId === build.id) {
    return { formatId: activeEgress.formatId, profileId: activeEgress.profileId };
  }
  const fallback = defaultCompatibleEgress(build.radioTargetId);
  if (!fallback) {
    throw new Error(`No compatible egress for radio target: ${build.radioTargetId}`);
  }
  return { formatId: fallback.formatId, profileId: fallback.profileId };
}

/** First egress pathway with the given formatId (e.g. neonplug, radio-io). */
export function findEgressByFormatId(
  egressPaths: EgressPath[],
  formatId: string,
): EgressPath | undefined {
  return egressPaths.find((path) => path.formatId === formatId);
}

/** NeonPlug egress that has a stored donor retain bag. */
export function findNeonplugDonorEgress(egressPaths: EgressPath[]): EgressPath | undefined {
  return egressPaths.find((path) => isNeonplugDonorBag(path.hydration));
}

/** Web Serial egress that has a stored radio-clone hydration bag. */
export function findRadioCloneEgress(egressPaths: EgressPath[]): EgressPath | undefined {
  return egressPaths.find((path) => isRadioCloneHydrationBag(path.hydration));
}
