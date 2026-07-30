import { isNativeApp } from './isNativeApp.ts';

export const PROD_API_ORIGIN = 'https://codeplug.mm9pdy.net';

/**
 * Resolves a relative API path (e.g. `/api/radioid/dmr/user/`) to:
 * - relative path on web (Vite / Cloudflare Pages same-origin)
 * - absolute `https://codeplug.mm9pdy.net/api/...` URL when running on Capacitor native
 */
export function resolveApiUrl(path: string): string {
  if (!isNativeApp()) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${PROD_API_ORIGIN}${cleanPath}`;
}
