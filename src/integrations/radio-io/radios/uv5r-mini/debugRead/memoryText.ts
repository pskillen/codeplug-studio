/** Memory-tab sentences and facts for the UV-5R Mini debug view; the app shell only displays them. */

/** Categories of the radio's memory that the debug view does not decode yet. */
export const UV5R_MINI_MEMORY_NOT_DECODED: readonly string[] = ['scan lists'];

/** The Mini stores one name field per channel and no separate callsign. */
export const UV5R_MINI_CHANNEL_CAVEAT: readonly string[] = [
  "Each identity is the radio's single name field, shown complete; separate callsign and name data is not stored.",
  'Only slots that hold a channel are listed; empty slots are skipped.',
];

export const UV5R_MINI_CHANNELS_CAPTION = 'UV-5R Mini memory channels';

export const UV5R_MINI_CHANNELS_EMPTY = 'No channels are stored.';

export const UV5R_MINI_CHANNELS_UNAVAILABLE = 'A complete channel range is required.';

export function uv5rMiniChannelSummary(listed: number, capacity: number): string {
  const n = (v: number) => v.toLocaleString('en-GB');
  return `${n(listed)} channels listed of ${n(capacity)} slots`;
}
