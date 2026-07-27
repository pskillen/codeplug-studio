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

export interface RadioWriteExperimentalCopy {
  title: string;
  lead: string;
  preferEgress: string;
}

export function resolveRadioWriteProdDisabledMessage(_profileId?: string): string {
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
  return null;
}
