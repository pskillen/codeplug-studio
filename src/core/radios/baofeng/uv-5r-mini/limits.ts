/**
 * Baofeng UV-5R Mini hardware / export limits.
 * Code mirror of [limits.md](../../../../docs/reference/radios/baofeng/uv-5r-mini/limits.md).
 * Used by CPS export adapters and Web Serial codecs — not library CRUD.
 */

export const UV5R_MINI_LIMITS = {
  /** Inclusive RX air band, inferred as AM on read because the clone has no AM bit. */
  AM_BAND_MIN_HZ: 108_000_000,
  AM_BAND_MAX_HZ: 135_999_999,
  /** Effective scan inclusion when channel + build omit override (CHIRP / radio-io convention). */
  DEFAULT_SCAN_INCLUSION: 'skip',
  /** MM9PDY zone table (MMZ1 v1): zones, characters per name, and channel slots a zone can hold. */
  ZONE_MAX: 24,
  ZONE_NAME_LENGTH: 12,
  ZONE_SLOTS: 999,
} as const;
