/** Memory-tab sentences for the OpenGD77 debug view; the app shell only displays them. */

const n = (v: number) => v.toLocaleString('en-GB');

export const OPENGD77_MEMORY_INTRO =
  'Read-only inventory decoded from the captured FLASH spans · radio slot order preserved. Nothing is imported into a library or build.';

export const opengd77RefusedTitle = (count: number) => `${count} entries refused`;

export interface OpenGd77ChannelCounts {
  occupied: number;
  empty: number;
  notCaptured: number;
  decoded: number;
  capacity: number;
}

export function opengd77ChannelSummary(c: OpenGd77ChannelCounts): string {
  return `Occupied ${n(c.occupied)} · empty ${n(c.empty)} · not captured ${n(c.notCaptured)} · decoded ${n(c.decoded)} · capacity ${n(c.capacity)} binary slots`;
}

export const OPENGD77_CHANNEL_CAVEAT: readonly string[] = [
  "Each name is the radio's single name field, shown complete; OpenGD77 channel records carry no separate callsign.",
  "Power is the radio's ladder step as a percentage of its range, not watts. TX contact and RX group are unresolved numbers: they are not resolved against the Contacts and RX groups tabs. Slots keep their one-based radio numbers.",
];

export const OPENGD77_CHANNELS_EMPTY = 'No occupied channel slot in the captured banks.';

export function opengd77BankMissingText(bank: number, first: number, last: number): string {
  return `Bank ${bank}, slots ${first} to ${last}: not captured. This does not mean the slots are empty.`;
}

export const OPENGD77_ZONES_UNAVAILABLE =
  'The zone bank was not completely captured, so no zone list can be shown. This does not mean the radio has no zones.';
export const OPENGD77_ZONES_EMPTY = 'The zone bank is captured and no zone is in use.';

export function opengd77ZoneSummary(used: number, capacity: number): string {
  return `${n(used)} of ${n(capacity)} zone slots in use`;
}

export const OPENGD77_ZONE_CAVEAT: readonly string[] = [
  'Members are shown in radio order, duplicates included. Each member is a one-based channel number. OpenGD77 uses a zone as its scan list.',
  'Click a zone to see its members.',
];

// Contacts, RX groups and the User Database.

export const OPENGD77_CONTACTS_UNAVAILABLE =
  'The contact bank was not completely captured, so no contact list can be shown. This does not mean the radio has no contacts.';
export const OPENGD77_CONTACTS_EMPTY = 'The contact bank is captured and no slot is in use.';
export const opengd77ContactSummary = (captured: number, capacity: number) =>
  `${n(captured)} captured of ${n(capacity)} contact slots`;
export const OPENGD77_CONTACT_CAVEAT: readonly string[] = [
  "Slots keep their one-based radio numbers. Call type is the radio's raw value (0 Group, 1 Private, 2 All call); anything else reads Unknown with that value. The time-slot override byte is shown raw: it is not decoded here.",
];

export const OPENGD77_RX_GROUPS_UNAVAILABLE =
  'The RX group list bank was not completely captured, so no list can be shown. This does not mean the radio has no RX groups.';
export const OPENGD77_RX_GROUPS_EMPTY = 'The RX group bank is captured and no list is in use.';
export const opengd77RxGroupSummary = (used: number, capacity: number) =>
  `${n(used)} of ${n(capacity)} RX group lists in use`;
export const OPENGD77_RX_GROUP_CAVEAT: readonly string[] = [
  'Members are contacts. A member the product decoder cannot resolve is counted and listed as unresolved, never dropped; resolved members are listed first.',
  'Select a list to see its members.',
];

export const OPENGD77_USER_DATABASE_NOT_CAPTURED =
  'This archive holds no User Database region. This does not mean the radio has none.';
export const opengd77UserDatabaseRefusedText = (reason: string) =>
  `The User Database region was not accepted: ${reason}.`;
export const opengd77UserDatabaseHeaderCounts = (
  headerEntries: number,
  captured: number,
  segment0: number,
  segment1: number,
  packedBytes: number,
) =>
  `Header entry count ${n(headerEntries)} · captured entries ${n(captured)} · segment 0 ${n(segment0)} · segment 1 ${n(segment1)} · packed length ${n(packedBytes)} bytes`;
export const OPENGD77_USER_DATABASE_CAVEAT: readonly string[] = [
  'Entries are stored packed in this archive; flash addresses below are the real addresses. Text is 6-bit packed and trimmed; characters outside the alphabet decode as spaces.',
];
export const opengd77UserDatabaseTruncatedText = (
  declared: number,
  shown: number,
  beyondProductMax: boolean,
) =>
  `The header declares ${n(declared)} entries but only ${n(shown)} are shown${
    beyondProductMax
      ? ': the product read caps the User Database below the header count.'
      : ': the stored bytes end early.'
  }`;
export const opengd77UserDatabaseSummary = (matching: number | undefined, captured: number) =>
  matching === undefined ? `${n(captured)} entries` : `${n(matching)} matching entries`;
export const OPENGD77_USER_DATABASE_EMPTY = 'This User Database has no captured entries.';
export const opengd77UserDatabaseNoMatch = (value: string) => `No entries match “${value}”.`;
