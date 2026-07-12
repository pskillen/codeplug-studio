/** Approved distributed-app registration (RepeaterBook API Apps dashboard). */
export const REPEATERBOOK_APP_ID = 103;

/** Prefix-match User-Agent approved for Codeplug Studio. Do not use browser default UA. */
export const REPEATERBOOK_USER_AGENT =
  'CodeplugStudio/1.0 (+https://codeplug.mm9pdy.net; mm9pdy@gmail.com)';

export const REPEATERBOOK_API_BASE = 'https://www.repeaterbook.com/api';

/** Same-origin Pages Function proxy (deployed) or Vite dev proxy (local). */
export const REPEATERBOOK_EXPORT_PROXY_PATH = '/api/repeaterbook/export';

/** Upstream RepeaterBook export endpoints — reference/docs only; browser uses proxy path. */
export const REPEATERBOOK_EXPORT_NA_URL = `${REPEATERBOOK_API_BASE}/export.php`;

export const REPEATERBOOK_EXPORT_ROW_URL = `${REPEATERBOOK_API_BASE}/exportROW.php`;

/** In-memory session cache TTL for RepeaterBook export responses (ms). */
export const REPEATERBOOK_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
