/**
 * The one gate for features the prod site hides (#1650). Every prod-hidden feature asks this function, directly or
 * through its own resolver (`resolveRadioWriteGate`, `resolveFirmwareFlashGate`, `resolveDebugPagesGate`); none keeps
 * its own `buildEnv === 'prod'` check.
 *
 * Rule: a feature marked prod-hidden is hidden on the prod build unless developer mode is on for this device. On every
 * other build (local, next, dev, staging) it is shown. Developer mode changes visibility only: the safety interlocks
 * inside a feature are the feature's own code and never read it.
 *
 * Uses Vite-injected {@link __BUILD_ENV__} (see docs/build/README.md). See docs/features/developer-mode/README.md.
 */

import { isDeveloperModeOn } from '@integrations/preferences/developerMode.ts';

export type ProdFeatureGate = 'hidden' | 'allowed';

export interface ProdFeatureGateOptions {
  /** Deploy environment. Default `__BUILD_ENV__`; pass it in tests. */
  buildEnv?: string;
  /** Developer mode on this device. Default: read from local storage at call time; pass it in tests. */
  developerMode?: boolean;
}

export function isProdBuildEnv(buildEnv: string = __BUILD_ENV__): boolean {
  return buildEnv === 'prod';
}

/** Pure given its options. `prodHidden` is the feature's own flag (`prodFlashDisabled`, `prodWriteDisabled`, ...). */
export function resolveProdFeatureGate(
  prodHidden: boolean,
  options: ProdFeatureGateOptions = {},
): ProdFeatureGate {
  if (!prodHidden) return 'allowed';
  if (!isProdBuildEnv(options.buildEnv ?? __BUILD_ENV__)) return 'allowed';
  if (options.developerMode ?? isDeveloperModeOn()) return 'allowed';
  return 'hidden';
}

/** The Debug pages (`/debug/*`) and their nav entry are prod-hidden. */
export function resolveDebugPagesGate(options: ProdFeatureGateOptions = {}): ProdFeatureGate {
  return resolveProdFeatureGate(true, options);
}
