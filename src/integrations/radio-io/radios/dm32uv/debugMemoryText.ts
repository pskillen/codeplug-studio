/** Memory-tab sentences for the DM-32UV debug view; the app shell only displays them. */

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
