/**
 * Identifying User-Agent required by Nominatim's usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/). Kept in sync with the
 * server-side copy in functions/lib/nominatimUpstream.ts — same duplication pattern as
 * RepeaterBook's `REPEATERBOOK_USER_AGENT` (constants.ts vs repeaterbookUpstream.ts).
 */
export const NOMINATIM_USER_AGENT =
  'CodeplugStudio/1.0 (+https://codeplug.mm9pdy.net; mm9pdy@gmail.com)';

/** Same-origin Pages Function proxy (deployed) or Vite dev proxy (local). */
export const NOMINATIM_SEARCH_PROXY_PATH = '/api/nominatim/search';
