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
} as const;
