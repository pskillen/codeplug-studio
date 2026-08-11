/**
 * Vendor-neutral predicate for whether a `(Satellite, SatelliteTransmitter)` pair should be
 * included the next time satellite keps are written to a radio. Originally defined only in
 * the Anytone D890 write codec (`src/integrations/radio-io/radios/at-d890uv/satelliteCodec.ts`,
 * #856), lifted here (#1067) now that a second consumer exists — the Library Satellite Keps
 * list page's per-satellite write-eligible-transmitter summary column.
 */

import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';

/**
 * Which `(satellite, transmitter)` pairs are eligible for a radio write.
 *
 * The `!dismissed` clause is a judgment call, flagged as such in the #856 planning notes:
 * dismissed rows are hidden from the SatelliteEditor UI, and write logic's position is that
 * they should not silently reach the radio either — a dismissed row reads as "the operator
 * doesn't want this one" even though `includeInWrite` was never explicitly flipped off.
 */
export function isTransmitterWriteEligible(
  satellite: Satellite,
  transmitter: SatelliteTransmitter,
): boolean {
  return satellite.enabled && transmitter.includeInWrite && !transmitter.dismissed;
}
