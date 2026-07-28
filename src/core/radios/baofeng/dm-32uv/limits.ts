/**
 * Baofeng DM-32UV / DP570UV hardware limits.
 * Code mirror of [limits.md](../../../../docs/reference/radios/baofeng/dm-32uv/limits.md).
 * Used by CPS export adapters and Web Serial codecs — not library CRUD.
 */

export const DM32UV_LIMITS = {
  /** Channel record `scanListId` is 4 bits (0 = none) → max 15 referenceable lists. */
  CHANNEL_SCAN_LIST_ID_MAX: 15,
  /** RX group bank size (metadata 0x0F). */
  RX_GROUPS_MAX: 32,
} as const;
