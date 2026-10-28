/**
 * Retevis RT95 VOX hardware / export limits.
 * Code mirror of docs/reference/radios/retevis/rt95/limits.md.
 * Used by export profiles and the Web Serial codec, not by library CRUD.
 */
export const RT95_LIMITS = {
  /** Memory channels (CHIRP memory_bounds 1..200). */
  CHANNEL_MAX: 200,
  /** Stock channel name length (CHIRP NAME_LENGTH). */
  NAME_LENGTH: 6,
  /** MM9PDY modded firmware, MMD1 v1: zones in the head's table. */
  ZONE_MAX: 32,
  /** MM9PDY modded firmware, MMD1 v1: zone name length (printable ASCII). */
  ZONE_NAME_LENGTH: 8,
  /** MM9PDY modded firmware, MMD1 v1: members per zone (any of the channels). */
  ZONE_MEMBERS_MAX: 200,
  /** MM9PDY modded firmware, MMD1 v1: channel description length (printable ASCII, no `_`). */
  DESCRIPTION_LENGTH: 12,
} as const;
