/**
 * Anytone AT-D890UV hardware limits.
 * Code mirror of [limits.md](../../../../docs/reference/radios/anytone/at-d890uv/limits.md).
 * Used by CPS export adapters and Web Serial codecs — not library CRUD.
 */

export const AT_D890UV_LIMITS = {
  CHANNEL_MAX: 4000,
  ZONE_MAX: 256,
  ZONE_MEMBERS_MAX: 64,
  SCAN_LISTS_MAX: 100,
  SCAN_LIST_MEMBERS_MAX: 100,
  RX_GROUP_LISTS_MAX: 128,
  RX_GROUP_MEMBERS_MAX: 32,
  TALK_GROUPS_MAX: 10_000,
  NAME_LENGTH: 16,
  APRS_SLOTS: 8,
} as const;
