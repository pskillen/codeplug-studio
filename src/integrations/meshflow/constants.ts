/** Public Meshflow API (Meshtastic mesh monitoring). Override with `VITE_MESHFLOW_API_BASE_URL`. */
export const DEFAULT_MESHFLOW_API_BASE = 'https://meshflow.pskillen.xyz/api';

export const MESHFLOW_PROVIDER = 'meshflow';

export const MESHFLOW_NETWORK_ERROR_MESSAGE =
  'Could not reach Meshflow — check your network connection.';

export const MESHFLOW_RATE_LIMIT_MESSAGE = 'Meshflow rate limit — wait before searching again.';

/** The endpoint clamps `radius_km` to 1–100. */
export const MESHFLOW_MAX_RADIUS_KM = 100;

export const MESHFLOW_LAST_HEARD_WITHIN_DAYS = 30;

/** Documentation only: the endpoint returns at most this many nodes. */
export const MESHFLOW_RESULT_CAP = 500;

export const MESHFLOW_NEARBY_PATH = '/nodes/observed-nodes/infrastructure/nearby/';
