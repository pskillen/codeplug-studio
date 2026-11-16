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

// Contacts, talk groups, RX groups and scan lists.

export const atD890BankSummary = (
  occupied: number,
  capacity: number,
  decoded: number,
  mine: number,
  noun: string,
  unclassified: number,
) =>
  `Bank occupied ${n(occupied)} of ${n(capacity)} slots · decoded ${n(decoded)} of ${n(occupied)} occupied · ${n(mine)} ${noun}${
    unclassified > 0 ? ` · ${n(unclassified)} unclassified` : ''
  }`;

export const atD890BankExplanation = (slots: number) =>
  `Contacts and talk groups share one bank of ${n(slots)} slots on the radio: private-call records are contacts, group and all-call records are talk groups. Slots keep their one-based radio numbers whichever tab filters them. The separate DMR ID database is outside this capture and is not decoded.`;
export const AT_D890UV_BANK_IDENTITY_NOTE =
  'Each identity shows the callsign first, then the name.';
export const atD890BankUnavailable = (noun: string) =>
  `The contact bank occupancy bitmap was not completely captured, so no ${noun} can be shown. This does not mean the radio has none.`;
export const atD890BankEmpty = (noun: string) =>
  `The bank bitmap is captured and no ${noun} are present.`;
export const atD890UnclassifiedText = (count: number) =>
  `${n(count)} occupied slots cannot be classified (not completely captured, malformed or of an unknown call type). They are listed in both Contacts and Talk groups rather than counted as empty.`;
export const atD890UsagePartialText = (missing: string) =>
  `${missing} coverage is incomplete, so only the references that were captured are listed. An empty list is not proof that nothing refers to a talk group.`;
export const atD890BankBitsText = (count: number, capacity: number, first: number) =>
  `${n(count)} bits are marked occupied above the ${n(capacity)} hardware slots (first: ${first}) and are not listed.`;

export const atD890RxSummary = (
  occupied: number,
  capacity: number,
  namesDecoded: number,
  membersDecoded: number,
) =>
  `Occupied ${n(occupied)} of ${n(capacity)} RX group slots · names decoded ${n(namesDecoded)} · member lists decoded ${n(membersDecoded)}`;
export const atD890RxCaveat = (bankCaptured: boolean): string[] => [
  `Members are shown at their stored positions, duplicates included; empty positions are skipped. Each member is a zero-based index into the shared contact bank and resolves to bank slot index + 1, never by DMR ID.${
    bankCaptured ? '' : ' The bank bitmap was not captured, so members cannot be resolved.'
  }`,
  'Select an RX group to see its members.',
];
export const AT_D890UV_RX_UNAVAILABLE =
  'The RX group occupancy bitmap was not completely captured, so no RX group list can be shown. This does not mean the radio has none.';
export const AT_D890UV_RX_EMPTY = 'The RX group bitmap is captured and no RX group is occupied.';
export const atD890RxBitsText = (bits: readonly number[], capacity: number) =>
  `Bits ${bits.join(', ')} are set above the ${n(capacity)} hardware lists and are not listed.`;
export const AT_D890UV_RX_MEMBERS_NOT_CAPTURED =
  "This RX group's member list was not completely captured.";

export const atD890ScanSummary = (occupied: number, capacity: number, decoded: number) =>
  `Occupied ${n(occupied)} of ${n(capacity)} scan list slots · fully decoded ${n(decoded)} of ${n(occupied)} occupied`;
export const atD890ScanCaveat = (membersMax: number): string[] => [
  'Name, member array and priority bytes decode independently, each only when its whole span was captured. Members keep radio order, duplicates included; a member index is zero-based and resolves to channel slot index + 1. Slots without a captured record are not proof of an unused list.',
  `Select a scan list to see its priority channels and members (up to ${membersMax}).`,
];
export const AT_D890UV_SCAN_UNAVAILABLE =
  'The scan list occupancy bitmap was not completely captured, so no scan list can be shown. This does not mean the radio has no scan lists.';
export const AT_D890UV_SCAN_EMPTY =
  'The scan list bitmap is captured and no scan list slot is occupied.';
export const atD890ScanBitsText = (bits: readonly number[], capacity: number) =>
  `Bits ${bits.join(', ')} are set above the ${n(capacity)} hardware scan lists and are not listed.`;
