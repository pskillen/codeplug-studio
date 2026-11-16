/** Memory-tab sentences for the DM-32UV debug view; the app shell only displays them. */

import { dm32TagHex } from './debugMemoryLists.ts';

const n = (v: number) => v.toLocaleString('en-GB');

export const DM32_MEMORY_INTRO =
  'Read-only inventory decoded from captured bytes · radio slot order preserved. Nothing is imported into a library or build. Not validated on hardware.';

export function dm32CaptureSummary(blocks: number, hasDiscovery: boolean): string {
  return `${blocks} whole 4 KiB blocks accepted · ${
    hasDiscovery
      ? 'page order from the discovery map'
      : 'no discovery map recorded, so page order is not established'
  }`;
}

export function dm32RefusedTitle(count: number): string {
  return `${count} archive entries refused`;
}

export const DM32_NOT_CAPTURED_TITLE = 'Not captured';
export const DM32_PAGE_ORDER_TITLE = 'Page order not established';

/** Shown under the unavailable-channels alert. */
export const DM32_CHANNELS_UNAVAILABLE_NOTE = 'This does not mean the radio has no channels.';

export const DM32_CHANNELS_EMPTY =
  'The channel count was captured and the radio states no channels.';

export interface Dm32ChannelCounts {
  declared: number;
  listed: number;
  capacity: number;
  decoded: number;
  empty: number;
  blank: number;
  notCaptured: number;
}

export function dm32ChannelSummary(c: Dm32ChannelCounts): string {
  return `The radio states ${n(c.declared)} channels · ${n(c.listed)} listed of ${n(c.capacity)} hardware slots · decoded ${n(c.decoded)} · empty ${n(c.empty)} · blank ${n(c.blank)} · not captured ${n(c.notCaptured)}`;
}

/** The dimmed lines under the count; the later ones fold behind More. */
export function dm32ChannelCaveat(txContactPagesMissing: boolean): string[] {
  return [
    'Slots without a captured record are listed as not captured; a missing capture does not mean a slot is unused.',
    "Each identity is the radio's single name field, shown complete including any callsign; separate callsign and name data is unavailable.",
    `The scan list resolves against the scan lists of this capture. TX contact resolves by position in the talk-group list, radio ID by zero-based index, and RX group as slot n = group n (assumed 1-based, not verified on hardware); references to lists that were not captured stay raw.${
      txContactPagesMissing ? ' Some TX contact pages were not captured.' : ''
    }`,
  ];
}

export function dm32ExcessTitle(): string {
  return 'Count above hardware capacity';
}

export function dm32ExcessText(excess: number, capacity: number): string {
  return `The stored count claims ${n(excess)} slots above the ${n(capacity)} hardware slots; they are not listed.`;
}

export const DM32_ZONES_EMPTY = 'The zone count was captured and the radio states no zones.';
export const DM32_ZONES_UNAVAILABLE_NOTE = 'This does not mean the radio has no zones.';

export interface Dm32ZoneCounts {
  declared: number;
  listed: number;
  capacity: number;
  decoded: number;
  vacant: number;
  notCaptured: number;
}

export function dm32ZoneSummary(c: Dm32ZoneCounts): string {
  return `The radio states ${n(c.declared)} zones · ${n(c.listed)} listed of ${n(c.capacity)} hardware zones · decoded ${n(c.decoded)} · vacant ${n(c.vacant)} · not captured ${n(c.notCaptured)}`;
}

export interface Dm32ZoneHeader {
  count: number;
  channelA: number;
  channelB: number;
  zoneA: number;
  zoneB: number;
}

export function dm32ZoneCaveat(h: Dm32ZoneHeader): string[] {
  return [
    "Zones are in radio order and each name is the radio's single name field, shown complete; separate callsign and name data is unavailable.",
    'Members are channel slot numbers shown in radio order, duplicates included, resolved against the channels of this capture. A record missing from the capture is not captured, never an unused zone.',
    `The meaning of the stored zone count is unverified. Header bytes (raw): count ${h.count}, channel A ${h.channelA}, channel B ${h.channelB}, zone A ${h.zoneA}, zone B ${h.zoneB}.`,
    'Click a zone to see its members.',
  ];
}

export const dm32ZoneExcessText = (excess: number, capacity: number) =>
  `The stored count claims ${n(excess)} zones above the ${n(capacity)} hardware zones; they are not listed.`;

export const DM32_SCAN_LISTS_EMPTY =
  'The scan-list page was captured and the radio states no scan lists.';
export const DM32_SCAN_LISTS_UNAVAILABLE_NOTE = 'This does not mean the radio has no scan lists.';

export interface Dm32ScanListCounts {
  declared: number;
  listed: number;
  capacity: number;
  decoded: number;
  vacant: number;
}

export function dm32ScanListSummary(c: Dm32ScanListCounts): string {
  return `The radio states ${n(c.declared)} scan lists · ${n(c.listed)} listed of ${n(c.capacity)} hardware lists · decoded ${n(c.decoded)} · vacant ${n(c.vacant)}`;
}

export const DM32_SCAN_LIST_CAVEAT: readonly string[] = [
  "Each name is the radio's single name field, shown complete; separate callsign and name data is unavailable. A non-empty list stores its named members plus one for the implicit current channel, so the raw byte is shown beside the named count.",
  'Members are channel slot numbers in radio order, resolved against the channels of this capture. Hang time, priority and designated TX are shown as raw hex only: their encodings are not established.',
  'Click a scan list to see its members.',
];

export const dm32ScanListExcessText = (excess: number, capacity: number) =>
  `The stored count claims ${n(excess)} lists above the ${n(capacity)} hardware lists; they are not listed.`;

// Talk groups, RX groups, radio IDs and contacts.

export const dm32ListUnavailableText = (reason: string | undefined, noun: string) =>
  `${reason ?? ''} This does not mean the radio has no ${noun}.`;

export function dm32TalkGroupSummary(
  decoded: number,
  pageCapacity: number,
  capacity: number,
  storedCount: number | undefined,
  quickAccess: string,
): string {
  const stored =
    storedCount === undefined
      ? `stored count: not captured (quick-access page ${quickAccess === 'ambiguous' ? 'ambiguous' : 'missing'})`
      : `stored count ${n(storedCount)}`;
  return `Decoded ${n(decoded)} talk groups from the first talk-group page (one page holds at most ${n(pageCapacity)} of the ${n(capacity)} hardware entries) · ${stored}`;
}
export const DM32_TALK_GROUP_CAVEAT =
  "This list is not complete: pages tagged 0x45 to 0x48 hold further talk-group data whose layout is not established, so they are not decoded. Position is the one-based place in the stored list that channel TX contacts refer to. Each name is the radio's single name field; callsign data is unavailable because the digital address book (V-frame 0x0F) is not captured. Not validated on hardware.";
export const dm32TalkGroupReferencesCaveat = (partialReasons: readonly string[]): string =>
  `Referenced by counts only captured channel TX contacts (by list position) and RX group members (matched by DMR ID).${
    partialReasons.length > 0 ? ` Partial: ${partialReasons.join('; ')}.` : ''
  }`;
export const DM32_TALK_GROUP_SELECT_HINT = 'Select a talk group to see what refers to it.';
export const DM32_TALK_GROUPS_EMPTY = 'The talk-group page was captured and holds no entries.';
export const dm32TalkGroupPagesText = (
  present: readonly { tag: number; count: number }[],
  missingTags: readonly number[],
): string =>
  `Pages 0x45 to 0x48: present, layout not established: ${
    present.length === 0
      ? 'none captured'
      : present.map((o) => `${dm32TagHex(o.tag)} (${o.count})`).join(', ')
  }${missingTags.length > 0 ? ` · not captured: ${missingTags.map(dm32TagHex).join(', ')}` : ''}`;
export const dm32TalkGroupMismatchText = (stored: number, decoded: number) =>
  `The quick-access page states ${n(stored)} talk groups; the first page decodes ${n(decoded)}. The difference is not explained by this capture.`;
export const dm32TalkGroupExcessText = (excess: number, capacity: number) =>
  `The stored count claims ${n(excess)} talk groups above the ${n(capacity)} hardware entries; they are not listed.`;

export const dm32RadioIdSummary = (
  declared: number,
  decoded: number,
  vacant: number,
  capacity: number,
) =>
  `The radio states ${n(declared)} radio IDs · ${n(decoded)} decoded · ${n(vacant)} vacant positions · ${n(capacity)} hardware entries`;
export const DM32_RADIO_ID_CAVEAT =
  "Radio IDs are the operator DMR IDs the radio transmits with. A channel refers to one by a zero-based index, so index n is slot n + 1 here. Each name is the radio's single name field. Not validated on hardware.";
export const DM32_RADIO_IDS_EMPTY = 'The radio-ID page was captured and holds no IDs.';
export const dm32RadioIdExcessText = (excess: number, capacity: number) =>
  `The stored count claims ${n(excess)} radio IDs above the ${n(capacity)} hardware entries; they are not listed.`;

export const DM32_DIGITAL_BOOK_TITLE = 'Digital address book (V-frame 0x0F bank): not captured';
export const DM32_DIGITAL_BOOK_TEXT =
  'The digital contact list is read through a separate bank this capture does not include, so no digital contacts or callsigns are shown. This does not mean the radio has none.';
export const dm32AnalogContactSummary = (declared: number, captured: number) =>
  `Analogue (DTMF) contacts: the radio states ${n(declared)} · ${n(captured)} raw records captured`;
export const DM32_ANALOG_CONTACT_CAVEAT =
  'The analogue contact record layout is not established, so records are shown as raw hex only. Not validated on hardware.';
export const DM32_ANALOG_CONTACTS_EMPTY =
  'The analogue contact page was captured and the radio states no contacts.';
export const dm32AnalogBeyondPageText = (beyond: number) =>
  `The stored count places ${n(beyond)} records beyond the captured page; they are not captured.`;

export const dm32RxGroupSummary = (
  decoded: number,
  capacity: number,
  occupiedSlots: readonly number[],
) =>
  `Decoded ${n(decoded)} RX groups of ${n(capacity)} hardware groups · occupied slots: ${
    occupiedSlots.length === 0 ? 'none' : occupiedSlots.join(', ')
  }`;
export const dm32RxGroupCaveat: readonly string[] = [
  "A group is present when its bit is set in the stored bitmask, so slots can have holes. Members are DMR IDs as stored, in stored order with duplicates kept; empty positions are shown as empty. A member is matched to a talk group by DMR ID only when exactly one decoded talk group has it. Each name is the radio's single name field; callsign data is unavailable. Not validated on hardware.",
  'Select an RX group to see its members.',
];
export const DM32_RX_GROUPS_EMPTY = 'The RX-group page was captured and no group bit is set.';
export const dm32RxGroupBitsText = (bits: number, capacity: number) =>
  `The bitmask sets ${n(bits)} bits above the ${n(capacity)} hardware groups; they are not listed.`;
