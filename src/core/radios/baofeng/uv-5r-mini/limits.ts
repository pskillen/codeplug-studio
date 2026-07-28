/**
 * Baofeng UV-5R Mini hardware / export limits.
 * Code mirror of [limits.md](../../../../docs/reference/radios/baofeng/uv-5r-mini/limits.md).
 * Used by CPS export adapters and Web Serial codecs — not library CRUD.
 */

export const UV5R_MINI_LIMITS = {
  /** Effective scan inclusion when channel + build omit override (CHIRP / radio-io convention). */
  DEFAULT_SCAN_INCLUSION: 'skip',
} as const;
