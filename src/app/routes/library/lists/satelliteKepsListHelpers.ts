/**
 * Pure display/filter helpers for `SatelliteKepsListPage` — split out so the "Frequencies"
 * cell formatting and the "satellites with mode" filter's distinct-mode list are unit
 * testable without mounting the route (DESIGN.md: system tests target core/services, not
 * React routes — this keeps the actual logic in a plain module the route just calls).
 */

import type { Satellite } from '@core/models/satellite.ts';
import { hzToMhzString } from '../../../lib/units.ts';
import { visibleTransmitters } from '../satelliteEditorHelpers.ts';

/** Empty-cell marker, matching the convention used elsewhere for missing frequency data. */
export const NO_FREQUENCY_DATA = '—';

/**
 * "Frequencies" column cell for one satellite row. Looks at **non-dismissed** transmitters
 * (`visibleTransmitters` — the same helper `SatelliteDetailPanel` uses for display) rather
 * than write-eligibility (`isAtD890SatelliteWriteEligible`), since this column answers "what
 * frequency data does this satellite have," not "would this currently be written" — a
 * disabled satellite or a transmitter with `includeInWrite: false` still has real frequency
 * data worth showing here.
 */
export function formatFrequenciesCell(satellite: Satellite): string {
  const usable = visibleTransmitters(satellite.transmitters);
  if (usable.length === 0) return NO_FREQUENCY_DATA;
  if (usable.length > 1) return `${usable.length} radios`;

  const transmitter = usable[0]!;
  const up = transmitter.uplinkHz != null ? hzToMhzString(transmitter.uplinkHz) : null;
  const down = transmitter.downlinkHz != null ? hzToMhzString(transmitter.downlinkHz) : null;
  if (up && down) return `${up} / ${down} MHz`;
  if (up) return `Up ${up} MHz`;
  if (down) return `Down ${down} MHz`;
  return NO_FREQUENCY_DATA;
}

/**
 * Distinct, non-blank `SatelliteTransmitter.mode` values across the library's non-dismissed
 * transmitters, alphabetised — options for the "satellites with mode" filter.
 */
export function distinctVisibleModes(satellites: readonly Satellite[]): string[] {
  const modes = new Set<string>();
  for (const satellite of satellites) {
    for (const transmitter of visibleTransmitters(satellite.transmitters)) {
      if (transmitter.mode) modes.add(transmitter.mode);
    }
  }
  return [...modes].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Whether `satellite` has at least one non-dismissed transmitter matching `mode`. */
export function satelliteHasVisibleMode(satellite: Satellite, mode: string): boolean {
  return visibleTransmitters(satellite.transmitters).some((t) => t.mode === mode);
}
