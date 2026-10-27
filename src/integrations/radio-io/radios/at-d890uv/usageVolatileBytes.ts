/**
 * AT-D890UV bytes that change when the radio is simply used, so a difference from a backup there is expected and
 * is not a failed restore. This is the one list: the range-change Check reads it, and
 * `docs/reference/radios/anytone/at-d890uv/memory-layout.md` (Usage-volatile bytes) documents it. Add to it here
 * only.
 *
 * Only offsets the memory-layout doc names are listed. Settings main `+0xD7..+0xDA` are named there as zone A/B
 * (`+0xD7`/`+0xD8`) and channel A/B (`+0xD9`/`+0xDA`); the retain preview reads the same bytes as the power-on
 * selection, so they may be the startup choice rather than the live one. They are listed because the doc names
 * them and a channel change on the radio was seen to differ there. `+0xD6` (startup enable) is a setting and is
 * not listed.
 */

import { D890_MAP } from './constants.ts';

export interface UsageVolatileSpan {
  /** Memory address of the first byte. */
  address: number;
  length: number;
  /** What the user sees, in the Check's "Changed since the restore" line. */
  label: string;
}

export const AT_D890_USAGE_VOLATILE_SPANS: readonly UsageVolatileSpan[] = [
  { address: D890_MAP.OptionalSettingsMain + 0xd7, length: 1, label: 'current zone (A)' },
  { address: D890_MAP.OptionalSettingsMain + 0xd8, length: 1, label: 'current zone (B)' },
  { address: D890_MAP.OptionalSettingsMain + 0xd9, length: 1, label: 'current channel (A)' },
  { address: D890_MAP.OptionalSettingsMain + 0xda, length: 1, label: 'current channel (B)' },
  {
    address: D890_MAP.ZoneAChannel,
    length: D890_MAP.ZoneTableBytes,
    label: 'current channel (Zone A)',
  },
  {
    address: D890_MAP.ZoneBChannel,
    length: D890_MAP.ZoneTableBytes,
    label: 'current channel (Zone B)',
  },
  // VFO A/B: tuning the VFO rewrites these channel slots (4000/4001).
  { address: D890_MAP.VfoChannels, length: D890_MAP.VfoChannelsLength, label: 'VFO A/B' },
];

/** The span holding `address`, or undefined when a difference there is a real one. */
export function usageVolatileSpanAt(address: number): UsageVolatileSpan | undefined {
  return AT_D890_USAGE_VOLATILE_SPANS.find(
    (s) => address >= s.address && address < s.address + s.length,
  );
}
