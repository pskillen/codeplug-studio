import type { DefaultScanInclusion } from '@core/models/radioBuild.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { UV5R_MINI_LIMITS } from '@core/radios/baofeng/uv-5r-mini/limits.ts';

/** Profile routing only — values live on radio-tier `limits.ts` modules. */
export function neonplugDefaultScanInclusion(profileId?: string): DefaultScanInclusion {
  if (profileId === 'neonplug-uv5rmini') {
    return UV5R_MINI_LIMITS.DEFAULT_SCAN_INCLUSION;
  }
  return DM32UV_LIMITS.DEFAULT_SCAN_INCLUSION;
}
