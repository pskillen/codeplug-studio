/**
 * UV-5R Mini MM9PDY: the Write projection (zones) as a zone-table upload intent for the codec in `./modData`.
 */

import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import type { Uv5rMiniZoneTableInput } from './modData/index.ts';

/**
 * `null` unless the projection is for the MM9PDY target (`writeUv5rMiniZones`). An empty table is still an
 * intent. Zones are expected finished (named, non-empty, capped) by the projection; channel numbers are
 * 1-based, slot indexes 0-based.
 */
export function uv5rMiniZoneIntentFromOrganisation(
  organisation: RadioWriteOrganisation | undefined,
): Uv5rMiniZoneTableInput | null {
  if (!organisation?.writeUv5rMiniZones) return null;
  return {
    zones: (organisation.zones ?? []).map((zone) => ({
      name: zone.wireName,
      slotIndexes: zone.channelNumbers.map((n) => n - 1),
    })),
  };
}
