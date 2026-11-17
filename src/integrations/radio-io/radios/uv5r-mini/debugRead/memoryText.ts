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

export const UV5R_MINI_ZONES_CAPTION = 'UV-5R Mini zones';

export const UV5R_MINI_ZONES_EMPTY = 'The zone table is valid and holds no zones.';

export const UV5R_MINI_ZONES_UNAVAILABLE =
  'Zone table unavailable: the complete sector was not captured.';

export const UV5R_MINI_ZONE_CAVEAT: readonly string[] = [
  'Each member is shown with the name stored in its channel slot; the Mini has no separate callsign.',
  'Members that point at an empty slot, or a slot that was not captured, are listed apart from the channel members.',
];

export function uv5rMiniZonesInvalid(reason: string): string {
  return `Zone table missing or invalid: ${reason}. This does not identify firmware.`;
}

export function uv5rMiniZoneSummary(zones: number): string {
  return `${zones.toLocaleString('en-GB')} ${zones === 1 ? 'zone' : 'zones'} listed`;
}

export function uv5rMiniZoneMembersLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

export const UV5R_MINI_ZONE_NO_MEMBERS = 'Empty zone.';

export function uv5rMiniZoneHiddenSummary(count: number): string {
  return `${count} ${count === 1 ? 'member points' : 'members point'} at empty or unavailable slots`;
}

/** One member that is not shown: its 1-based slot and why. */
export function uv5rMiniZoneHiddenMember(slot: number, channelsKnown: boolean): string {
  return `${slot} (${channelsKnown ? 'empty' : 'channel unavailable'})`;
}
