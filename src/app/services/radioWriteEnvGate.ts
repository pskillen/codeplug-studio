/**
 * Deploy-environment gate for experimental direct serial Write paths.
 * Uses Vite-injected {@link __BUILD_ENV__} (see docs/build/README.md).
 */

import type { RadioDescriptor } from '@integrations/radio-io/types.ts';

export type RadioWriteGate = 'hidden' | 'allowed';

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
  return 'allowed';
}

export const RADIO_WRITE_PROD_DISABLED_MESSAGE =
  'Direct serial Write to this radio is disabled on the production site. Use the radio target file export route instead.';

export function resolveRadioWriteProdDisabledMessage(profileId?: string): string {
  void profileId;
  return RADIO_WRITE_PROD_DISABLED_MESSAGE;
}
