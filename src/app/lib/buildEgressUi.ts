import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { defaultCompatibleEgress } from '@core/radio-targets/index.ts';

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
