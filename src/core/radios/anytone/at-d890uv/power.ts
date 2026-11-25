import type { PowerLadderEntry } from '@core/import-export/profileLadder.ts';
import { CHANNEL_POWER_ABOVE_HIGH } from '@core/models/library.ts';

export const AT_D890UV_POWER_TIERS = {
  turbo: { wire: 'Turbo', percent: CHANNEL_POWER_ABOVE_HIGH, approxWatts: '7 W VHF / 6 W UHF' },
  high: { wire: 'High', percent: 100, approxWatts: '5 W' },
  mid: { wire: 'Mid', percent: 50, approxWatts: '2.5 W' },
  low: { wire: 'Low', percent: 25, approxWatts: '0.2 W' },
} as const satisfies Record<string, PowerLadderEntry>;

const { turbo, high, mid, low } = AT_D890UV_POWER_TIERS;

export const AT_D890UV_POWER_LADDER: readonly PowerLadderEntry[] = [turbo, high, mid, low];

/** Keep the original CSV cutoffs between the ordinary tiers as their decode anchors change. */
export function selectAtD890Power(percent: number | null) {
  if (percent == null) return high;
  if (percent > high.percent) return turbo;
  if (percent < 37.5) return low;
  if (percent < 62.5) return mid;
  return high;
}
