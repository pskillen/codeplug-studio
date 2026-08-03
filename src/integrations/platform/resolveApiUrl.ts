import { isNativeApp } from './isNativeApp.ts';

export const PROD_API_ORIGIN = 'https://codeplug.mm9pdy.net';
export const STAGING_API_ORIGIN = 'https://staging.codeplug.mm9pdy.net';

/** Native API host for the given deploy channel (see docs/build/README.md). */
export function resolveNativeApiOrigin(buildEnv: string = __BUILD_ENV__): string {
  return buildEnv === 'prod' ? PROD_API_ORIGIN : STAGING_API_ORIGIN;
}

/**
 * Resolves a relative API path (e.g. `/api/radioid/dmr/user/`) to:
 * - relative path on web (Vite / Cloudflare Pages same-origin)
 * - absolute API origin + path on Capacitor native (`prod` → apex; else staging)
 */
export function resolveApiUrl(path: string, buildEnv: string = __BUILD_ENV__): string {
  if (!isNativeApp()) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${resolveNativeApiOrigin(buildEnv)}${cleanPath}`;
}
