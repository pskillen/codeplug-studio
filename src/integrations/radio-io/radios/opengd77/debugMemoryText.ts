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
