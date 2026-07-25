/**
 * Deploy-environment gate for experimental direct serial Write paths.
 * Uses Vite-injected {@link __BUILD_ENV__} (see docs/build/README.md).
 */

import type { RadioDescriptor } from '@integrations/radio-io/types.ts';

export type RadioWriteGate = 'hidden' | 'warn' | 'allowed';

export function isProdBuildEnv(buildEnv: string = __BUILD_ENV__): boolean {
  return buildEnv === 'prod';
}

/** Pure resolver — pass `buildEnv` in tests. */
export function resolveRadioWriteGate(
  descriptor: Pick<RadioDescriptor, 'prodWriteDisabled'> | undefined,
  buildEnv: string = __BUILD_ENV__,
): RadioWriteGate {
  if (!descriptor?.prodWriteDisabled) return 'allowed';
  if (buildEnv === 'prod') return 'hidden';
  return 'warn';
}

export const RADIO_WRITE_PROD_DISABLED_MESSAGE =
  'Direct serial Write to this radio is disabled on the production site. Switch this build to Anytone CSV export instead.';

export const AT_D890_WRITE_EXPERIMENTAL_TITLE = 'Highly experimental — soft-brick risk';

export const AT_D890_WRITE_EXPERIMENTAL_LEAD =
  'Direct serial Write to the Anytone AT-D890UV has roughly a 50/50 chance of soft-bricking your radio.';

export const AT_D890_WRITE_EXPERIMENTAL_PREFER_CSV = 'Prefer the Anytone CSV export route for now.';

export const RT95_WRITE_EXPERIMENTAL_TITLE = 'Not verified on real hardware yet';

export const RT95_WRITE_EXPERIMENTAL_LEAD =
  'We have not tested Read or Write on a physical Retevis RT95 VOX yet. The encode path follows published CHIRP facts, but a bug could still leave your radio in a bad state.';

export const RT95_WRITE_EXPERIMENTAL_PREFER_CSV =
  'Prefer CHIRP CSV export for now. Sorry — direct serial Write is not available on the production site yet.';

export const RT95_WRITE_PROD_DISABLED_MESSAGE =
  'Direct serial Write to the Retevis RT95 VOX is disabled on the production site. Use CHIRP CSV export on this build instead.';

export const MD9600_WRITE_EXPERIMENTAL_TITLE = 'Not verified on real hardware yet';

export const MD9600_WRITE_EXPERIMENTAL_LEAD =
  'We have not tested Read or Write on a physical TYT MD-9600 or Retevis RT-90 yet. This path is a work in progress. A bug could leave your radio in a bad state.';

export const MD9600_WRITE_EXPERIMENTAL_PREFER_CSV =
  'Prefer OpenGD77 CSV export for now. Sorry — direct serial Write is not available on the production site yet.';

export const MD9600_WRITE_PROD_DISABLED_MESSAGE =
  'Direct serial Write to the TYT MD-9600 / RT-90 is disabled on the production site. Use OpenGD77 CSV export on this build instead.';

export interface RadioWriteExperimentalCopy {
  title: string;
  lead: string;
  preferEgress: string;
}

export function resolveRadioWriteProdDisabledMessage(profileId?: string): string {
  if (profileId === 'radio-io-rt95') return RT95_WRITE_PROD_DISABLED_MESSAGE;
  if (profileId === 'radio-io-opengd77-md9600') return MD9600_WRITE_PROD_DISABLED_MESSAGE;
  if (profileId === 'radio-io-at-d890uv') return RADIO_WRITE_PROD_DISABLED_MESSAGE;
  return RADIO_WRITE_PROD_DISABLED_MESSAGE;
}

export function resolveRadioWriteExperimentalCopy(
  profileId?: string,
): RadioWriteExperimentalCopy | null {
  if (profileId === 'radio-io-at-d890uv') {
    return {
      title: AT_D890_WRITE_EXPERIMENTAL_TITLE,
      lead: AT_D890_WRITE_EXPERIMENTAL_LEAD,
      preferEgress: AT_D890_WRITE_EXPERIMENTAL_PREFER_CSV,
    };
  }
  if (profileId === 'radio-io-rt95') {
    return {
      title: RT95_WRITE_EXPERIMENTAL_TITLE,
      lead: RT95_WRITE_EXPERIMENTAL_LEAD,
      preferEgress: RT95_WRITE_EXPERIMENTAL_PREFER_CSV,
    };
  }
  if (profileId === 'radio-io-opengd77-md9600') {
    return {
      title: MD9600_WRITE_EXPERIMENTAL_TITLE,
      lead: MD9600_WRITE_EXPERIMENTAL_LEAD,
      preferEgress: MD9600_WRITE_EXPERIMENTAL_PREFER_CSV,
    };
  }
  return null;
}
