/** Memory-tab sentences and facts for the RT95 debug view; the app shell only displays them. */

/** Categories of the radio's memory that the debug view does not decode yet. */
export const RT95_MEMORY_NOT_DECODED: readonly string[] = ['scan lists', 'contacts', 'talk groups'];

/** Provenance is stated once here, not on every cell; only a channel description keeps `[body]`. */
export const RT95_CHANNEL_CAVEAT: readonly string[] = [
  'Clone image: the storage MCU is not documented. Descriptions come from MMD1 data (main board).',
  "The RT95 record has no callsign field, so each identity is the radio's single name field as stored.",
];

export const RT95_CHANNELS_EMPTY = 'No channel slots to show.';

export function rt95ChannelSummary(
  listed: number,
  capacity: number,
  includesEmpty: boolean,
): string {
  const n = (v: number) => v.toLocaleString('en-GB');
  return `${n(listed)} slots listed of ${n(capacity)}${includesEmpty ? ' (empty slots included)' : ' (occupied slots only)'}`;
}

/** Identity text for a slot that is not an occupied, named channel. */
export function rt95SlotIdentityFallback(occupancy: 'occupied' | 'empty' | 'unavailable'): string {
  if (occupancy === 'occupied') return '(unnamed)';
  return occupancy === 'empty' ? 'Empty slot' : 'Slot not captured';
}

export const RT95_ZONES_PROVENANCE = 'MMD1 data: main board.';
export const RT95_PKEYS_PROVENANCE = 'Clone image: the storage MCU is not documented.';

/** Shown in a slot's details when its record bytes were not captured. */
export const RT95_SLOT_RAW_UNAVAILABLE = 'Unavailable';

/** The details line of a clicked channel slot; `hex` is the record as hex bytes. */
export function rt95SlotDetailsText(slot: number, hex: string): string {
  return `Slot ${slot} raw record. Unresolved flags and bytes; raw evidence: ${hex}`;
}

export const RT95_ZONES_BODY_CAVEAT =
  'Body EEPROM is reached through the head; it can return checksum-valid zeros without a body reply. Running firmware, release and modification status remain unknown.';
