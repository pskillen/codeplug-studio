/** Same-origin Pages Function proxy (deployed) or Vite dev proxy (local). */
export const RADIOID_DMR_USER_PROXY_PATH = '/api/radioid/dmr/user';

/** Upstream RadioID.net API — browser uses proxy path. */
export const RADIOID_DMR_USER_UPSTREAM = 'https://database.radioid.net/api/dmr/user/';

export const RADIOID_CACHE_PREFIX = 'radioid-api:';

export const RADIOID_PROVIDER = 'radioid';

export const RADIOID_MAX_PER_PAGE = 100;

export const RADIOID_RATE_LIMIT_MESSAGE =
  'RadioID.net rate limit reached — wait before searching again.';

export const RADIOID_NETWORK_ERROR_MESSAGE =
  'Could not reach RadioID.net — check your network connection.';
