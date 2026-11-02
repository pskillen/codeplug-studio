import { fetchCachedText } from '../http/cachedFetch.ts';
import { MESHFLOW_CACHE_PREFIX } from '../http/sessionCache.ts';
import {
  DEFAULT_MESHFLOW_API_BASE,
  MESHFLOW_LAST_HEARD_WITHIN_DAYS,
  MESHFLOW_MAX_RADIUS_KM,
  MESHFLOW_NEARBY_PATH,
  MESHFLOW_NETWORK_ERROR_MESSAGE,
  MESHFLOW_PROVIDER,
  MESHFLOW_RATE_LIMIT_MESSAGE,
} from './constants.ts';
import { MeshflowError } from './errors.ts';
import type {
  MeshtasticInfrastructureNode,
  MeshtasticNearbyQuery,
  MeshtasticNearbyResult,
} from './types.ts';

/** Wire row (snake_case) — private to this module. */
interface MeshflowNearbyWireRow {
  node_id_str?: unknown;
  long_name?: unknown;
  short_name?: unknown;
  meshtastic_role_label?: unknown;
  meshtastic_hw_model?: unknown;
  last_heard?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  altitude?: unknown;
}

interface MeshflowNearbyWireResponse {
  results?: unknown;
  meta?: { truncated?: unknown } | null;
}

/** `VITE_MESHFLOW_API_BASE_URL` (e.g. http://localhost:8000/api), else the public service. */
export function meshflowApiBase(): string {
  const base = import.meta.env.VITE_MESHFLOW_API_BASE_URL?.trim() || DEFAULT_MESHFLOW_API_BASE;
  return base.replace(/\/+$/, '');
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** The radius sent to Meshflow: whole km, +1 for the rounded point, clamped to 1–100. */
export function meshflowRequestRadiusKm(radiusKm: number): number {
  const wanted = Math.ceil(radiusKm) + 1;
  return Math.min(MESHFLOW_MAX_RADIUS_KM, Math.max(1, Number.isFinite(wanted) ? wanted : 1));
}

/**
 * Request URL. The search point is rounded to 2 decimals (~1 km) so the exact position never
 * leaves the browser; the caller applies the exact radius.
 */
export function buildMeshflowNearbyUrl(
  query: MeshtasticNearbyQuery,
  base: string = meshflowApiBase(),
): string {
  const search = new URLSearchParams({
    lat: round2(query.lat),
    lon: round2(query.lon),
    radius_km: String(meshflowRequestRadiusKm(query.radiusKm)),
    last_heard_within_days: String(MESHFLOW_LAST_HEARD_WITHIN_DAYS),
  });
  return `${base.replace(/\/+$/, '')}${MESHFLOW_NEARBY_PATH}?${search.toString()}`;
}

/** "ROUTER_CLIENT" becomes "Router client". Opaque: no lookup table. */
export function humaniseRole(label: string): string {
  const words = label.trim().toLowerCase().split('_').filter(Boolean).join(' ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normaliseNode(row: MeshflowNearbyWireRow): MeshtasticInfrastructureNode | null {
  const nodeId = str(row.node_id_str);
  if (!nodeId) return null;
  const lat = row.latitude;
  const lon = row.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const heard = typeof row.last_heard === 'string' ? row.last_heard : null;
  return {
    nodeId,
    longName: str(row.long_name),
    shortName: str(row.short_name),
    role: humaniseRole(str(row.meshtastic_role_label)),
    hardwareModel: str(row.meshtastic_hw_model),
    lastHeardAt: heard && Number.isFinite(Date.parse(heard)) ? heard : null,
    location: { lat, lon },
    altitudeM:
      typeof row.altitude === 'number' && Number.isFinite(row.altitude) ? row.altitude : null,
  };
}

function errorMessage(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed?.error === 'string' && parsed.error.trim()) {
      return `Meshflow: ${parsed.error.trim()}`;
    }
  } catch {
    // fall through
  }
  return `Meshflow returned ${status}.`;
}

/**
 * Meshtastic routers and repeaters near a point. A simple credential-less GET: no custom headers,
 * so browsers send no CORS preflight.
 */
export async function searchMeshtasticInfrastructureNear(
  query: MeshtasticNearbyQuery,
): Promise<MeshtasticNearbyResult> {
  const url = buildMeshflowNearbyUrl(query);
  const { body, status } = await fetchCachedText(url, {
    provider: MESHFLOW_PROVIDER,
    cachePrefix: MESHFLOW_CACHE_PREFIX,
    init: { credentials: 'omit' },
    networkErrorMessage: MESHFLOW_NETWORK_ERROR_MESSAGE,
    rateLimitMessage: MESHFLOW_RATE_LIMIT_MESSAGE,
    createError: (message, errorStatus) => new MeshflowError(message, errorStatus),
  });

  if (status < 200 || status >= 300) {
    throw new MeshflowError(errorMessage(body, status), status);
  }

  let parsed: MeshflowNearbyWireResponse;
  try {
    parsed = JSON.parse(body) as MeshflowNearbyWireResponse;
  } catch {
    throw new MeshflowError('Invalid response from Meshflow.');
  }

  const rows = Array.isArray(parsed?.results) ? (parsed.results as MeshflowNearbyWireRow[]) : [];
  const byId = new Map<string, MeshtasticInfrastructureNode>();
  for (const row of rows) {
    if (row == null || typeof row !== 'object') continue;
    const node = normaliseNode(row);
    if (node && !byId.has(node.nodeId)) byId.set(node.nodeId, node);
  }

  return {
    nodes: [...byId.values()],
    truncated: parsed?.meta?.truncated === true,
    requestedRadiusKm: meshflowRequestRadiusKm(query.radiusKm),
  };
}
