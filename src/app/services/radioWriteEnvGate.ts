/**
 * Deploy-environment gate for experimental direct serial Write paths (`prodWriteDisabled`).
 * A thin wrapper over the one prod gate in `prodFeatureGate.ts` (#1650).
 */

import type { RadioDescriptor } from '@integrations/radio-io/types.ts';
import { isCapacitorSerialSupported } from '@integrations/radio-io/transport/featureDetect.ts';

import { isProdBuildEnv, resolveProdFeatureGate, type ProdFeatureGate } from './prodFeatureGate.ts';

export type RadioWriteGate = ProdFeatureGate;

export { isProdBuildEnv };

/**
 * Pure resolver — pass `buildEnv` and `developerMode` in tests. Asks the one prod gate
 * ({@link resolveProdFeatureGate}): Write is prod-hidden when the profile carries `prodWriteDisabled`, or when the
 * descriptor does and this is not the native app (the companion app is a dedicated environment, so OTG Write stays
 * open there). Developer mode on this device shows it on prod (#1650).
 */
export function resolveRadioWriteGate(
  descriptor:
    | (Pick<RadioDescriptor, 'prodWriteDisabled'> &
        Partial<Pick<RadioDescriptor, 'compatibleProfiles'>>)
    | undefined,
  buildEnv: string = __BUILD_ENV__,
  profileId?: string,
  developerMode?: boolean,
): RadioWriteGate {
  // Per-profile flag: no native-platform exemption (for a profile whose firmware is unreleased).
  const profileDisabled =
    profileId !== undefined &&
    (descriptor?.compatibleProfiles ?? []).some(
      (p) => p.profileId === profileId && p.prodWriteDisabled === true,
    );
  const descriptorDisabled =
    descriptor?.prodWriteDisabled === true && !isCapacitorSerialSupported();
  return resolveProdFeatureGate(profileDisabled || descriptorDisabled, { buildEnv, developerMode });
}

export const RADIO_WRITE_PROD_DISABLED_MESSAGE =
  'Direct serial Write to this radio is disabled on the production site. Use the radio target file export route instead.';

export function resolveRadioWriteProdDisabledMessage(profileId?: string): string {
  void profileId;
  return RADIO_WRITE_PROD_DISABLED_MESSAGE;
}
