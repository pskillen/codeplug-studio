/** Memory-tab sentences for the AT-D890UV debug view; the app shell only displays them. */

const n = (v: number) => v.toLocaleString('en-GB');

export const AT_D890UV_MEMORY_INTRO =
  'Read-only inventory decoded from captured bytes · radio slot order preserved. Nothing is imported into a library or build.';

export function atD890CaptureSummary(
  accepted: number,
  vital: number,
  unclassified: number,
): string {
  return `${accepted} sparse configuration entries accepted · ${vital} vital and ${unclassified} unclassified entries excluded`;
}

export const atD890RefusedTitle = (count: number) => `${count} sparse entries refused`;

export const AT_D890UV_CHANNELS_UNAVAILABLE =
  'The channel occupancy bitmap was not completely captured, so no channel list can be shown. This does not mean the radio has no channels.';
export const AT_D890UV_CHANNELS_EMPTY =
  'The channel bitmap is captured and no channel slot is occupied.';

export function atD890ChannelSummary(occupied: number, capacity: number, decoded: number): string {
  return `Occupied ${n(occupied)} of ${n(capacity)} channel slots · decoded ${n(decoded)} of ${n(occupied)} occupied`;
}

export function atD890ChannelCaveat(capacity: number): string[] {
  return [
    `Hardware capacity is ${n(capacity)} slots. Slots without a record in this capture are not listed, and a missing capture does not mean a slot is unused.`,
    "Each identity is the radio's single name field, shown complete including any callsign; separate callsign and name data is unavailable in this capture.",
  ];
}

export const AT_D890UV_BITMAP_BITS_TITLE = 'Bitmap bits beyond the slot range';
export function atD890ChannelBitsText(bits: readonly number[], capacity: number): string {
  return `Bits ${bits.join(', ')} are set above the ${n(capacity)} hardware slots and are not listed.`;
}

export const AT_D890UV_ZONES_UNAVAILABLE =
  'The zone occupancy bitmap was not completely captured, so no zone list can be shown. This does not mean the radio has no zones.';
export const AT_D890UV_ZONES_EMPTY = 'The zone bitmap is captured and no zone slot is occupied.';

export function atD890ZoneSummary(
  occupied: number,
  capacity: number,
  names: number,
  members: number,
): string {
  return `Occupied ${n(occupied)} of ${n(capacity)} zone slots · names decoded ${n(names)} · member lists decoded ${n(members)}`;
}

export const AT_D890UV_ZONE_CAVEAT: readonly string[] = [
  'Members are shown in radio order, duplicates included. A member index is zero-based and resolves to channel slot index + 1. The zone A and B channel tables select a channel within a zone and are not shown as member lists.',
  'Click a zone to see its members.',
];

export const AT_D890UV_ZONE_BITS_TITLE = 'Bitmap bits beyond the zone range';
export function atD890ZoneBitsText(bits: readonly number[], capacity: number): string {
  return `Bits ${bits.join(', ')} are set above the ${n(capacity)} hardware zones and are not listed.`;
}

export const AT_D890UV_ZONE_MEMBERS_NOT_CAPTURED =
  "This zone's member list was not completely captured.";
export const AT_D890UV_ZONE_OVER_CAPACITY_TITLE = 'More members than the hardware allows';
export const atD890ZoneOverCapacityText = (max: number) =>
  `The list holds more than ${max} members.`;
