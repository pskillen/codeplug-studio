import { parseTleBlock } from '@core/domain/tle/parseTle.ts';
import type { ParsedTleEntry, TleParseWarning } from '@core/domain/tle/tleTypes.ts';
import type { SatelliteSource } from '@core/models/satellite.ts';
import { fetchAmsatNasabareTle } from './amsatClient.ts';
import { fetchCelestrakAmateurTle } from './celestrakClient.ts';

export interface FetchSatelliteSetResult {
  source: SatelliteSource;
  entries: ParsedTleEntry[];
  warnings: TleParseWarning[];
}

/**
 * Fetch the amateur satellite TLE feed, trying CelesTrak first and falling
 * back to AMSAT if CelesTrak is unreachable or rate-limited.
 */
export async function fetchSatelliteSet(options?: {
  refresh?: boolean;
}): Promise<FetchSatelliteSetResult> {
  try {
    const text = await fetchCelestrakAmateurTle(options);
    const { entries, warnings } = parseTleBlock(text);
    return { source: 'celestrak', entries, warnings };
  } catch {
    const text = await fetchAmsatNasabareTle(options);
    const { entries, warnings } = parseTleBlock(text);
    return { source: 'amsat', entries, warnings };
  }
}
