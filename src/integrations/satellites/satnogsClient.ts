import {
  groupSatnogsTransmittersByNoradId,
  type ParsedSatnogsEnrichmentEntry,
} from '@core/domain/satnogs/parseSatnogsTransmitters.ts';
import type { SatnogsTransmitterRaw } from '@core/domain/satnogs/satnogsTypes.ts';
import { resolveApiUrl } from '../platform/resolveApiUrl.ts';
import { fetchSatelliteDirectoryText } from './directoryFetch.ts';
import { SATNOGS_CACHE_PREFIX } from './sessionCache.ts';
import { SatelliteDirectoryError } from './types.ts';

export const SATNOGS_TRANSMITTERS_API_PATH = '/api/satnogs/transmitters';

/** Fetch raw SatNOGS transmitter records for a single NORAD catalog id. */
export async function fetchSatnogsTransmittersForNoradId(
  noradId: number,
  options?: { refresh?: boolean },
): Promise<SatnogsTransmitterRaw[]> {
  // `satellite__norad_cat_id` — not `norad_cat_id` — is the actual filterable field on
  // SatNOGS DB's transmitters endpoint; `norad_cat_id` appears in every response record but
  // is a read-only field on the related satellite, not a query filter, and is silently
  // ignored (returning the full unfiltered list) if used directly. Verified against the live
  // API — see docs/reference/remote-directories/satnogs/README.md.
  const url = resolveApiUrl(
    `${SATNOGS_TRANSMITTERS_API_PATH}?satellite__norad_cat_id=${encodeURIComponent(String(noradId))}`,
  );
  const { body, status } = await fetchSatelliteDirectoryText(url, {
    provider: 'satnogs',
    cachePrefix: SATNOGS_CACHE_PREFIX,
    cacheKeySuffix: String(noradId),
    skipCache: options?.refresh === true,
    networkErrorMessage: 'Could not reach SatNOGS — check your network connection.',
  });

  if (status < 200 || status >= 300) {
    throw new SatelliteDirectoryError(`SatNOGS returned ${status}.`, status);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new SatelliteDirectoryError('Could not parse SatNOGS transmitter response.');
  }

  if (!Array.isArray(parsed)) {
    throw new SatelliteDirectoryError('SatNOGS returned an unexpected response shape.');
  }

  return parsed as SatnogsTransmitterRaw[];
}

export interface FetchSatnogsEnrichmentResult {
  entries: ParsedSatnogsEnrichmentEntry[];
  /** NORAD ids that failed to fetch — a partial failure does not abort the whole batch. */
  failures: { noradId: number; message: string }[];
}

/**
 * Fetch and decode SatNOGS transmitter data for a set of NORAD ids. Each id is fetched
 * independently (SatNOGS DB filters by a single `norad_cat_id` per request) and failures
 * are collected rather than thrown, so one unreachable satellite doesn't block the rest of
 * the batch from enriching.
 */
export async function fetchSatnogsEnrichmentForNoradIds(
  noradIds: number[],
  options?: { refresh?: boolean },
): Promise<FetchSatnogsEnrichmentResult> {
  const unique = Array.from(new Set(noradIds));
  const settled = await Promise.allSettled(
    unique.map((noradId) => fetchSatnogsTransmittersForNoradId(noradId, options)),
  );

  const raw: SatnogsTransmitterRaw[] = [];
  const failures: { noradId: number; message: string }[] = [];

  settled.forEach((result, index) => {
    const noradId = unique[index];
    if (result.status === 'fulfilled') {
      raw.push(...result.value);
    } else {
      const message =
        result.reason instanceof Error ? result.reason.message : 'SatNOGS fetch failed.';
      failures.push({ noradId, message });
    }
  });

  return { entries: groupSatnogsTransmittersByNoradId(raw), failures };
}
