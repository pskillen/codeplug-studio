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
