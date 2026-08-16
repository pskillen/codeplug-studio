/** Same-origin Pages Function proxy (deployed) or Vite dev proxy (local). */
export const RADIOID_DMR_USER_PROXY_PATH = '/api/radioid/dmr/user/';

/** Daily worldwide user dump — separate host from JSON API. */
export const RADIOID_USER_DUMP_PROXY_PATH = '/api/radioid-static/user.csv';

/** Upstream RadioID.net API — browser uses proxy path. */
export const RADIOID_DMR_USER_UPSTREAM = 'https://database.radioid.net/api/dmr/user/';

/** Upstream daily CSV dump — browser uses {@link RADIOID_USER_DUMP_PROXY_PATH}. */
export const RADIOID_USER_DUMP_UPSTREAM = 'https://radioid.net/static/user.csv';

/** User-Agent for RadioID.net upstream requests (AUP: identify the app). */
export const RADIOID_USER_AGENT =
  'CodeplugStudio/1.0 (+https://codeplug.mm9pdy.net; mm9pdy@gmail.com)';

export const RADIOID_CACHE_PREFIX = 'radioid-api:';

export const RADIOID_PROVIDER = 'radioid';

export const RADIOID_MAX_PER_PAGE = 200;

export const RADIOID_RATE_LIMIT_MESSAGE =
  'RadioID.net rate limit reached — wait before searching again.';

export const RADIOID_NETWORK_ERROR_MESSAGE =
  'Could not reach RadioID.net — check your network connection.';
