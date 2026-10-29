/**
 * RT95 MM9PDY Review nudge: zones will be written but no key is set to open the zone selector.
 */

import { StatusBanner } from '../v2/index.ts';

export interface Rt95ZoneKeyNudgeProps {
  /** Zones the Write will store. */
  zones: number;
  /** True when the build sets Put Zone on a P-key. */
  zoneKeySet: boolean;
}

export default function Rt95ZoneKeyNudge({ zones, zoneKeySet }: Rt95ZoneKeyNudgeProps) {
  if (zones <= 0 || zoneKeySet) return null;
  return (
    <div data-testid="rt95-zone-key-nudge">
      <StatusBanner tone="info">
        No key opens the zone selector. Set Zone on a P-key in export settings, or set a key to DIR
        in the CPS.
      </StatusBanner>
    </div>
  );
}
