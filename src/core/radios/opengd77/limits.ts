/**
 * OpenGD77 / OpenUV380 family hardware limits (DM-1701, MD-9600, …).
 * Code mirror of tier-3 radio docs under docs/reference/radios/.
 * Used by CPS export adapters and Web Serial codecs — not library CRUD.
 */

export const OPENGD77_FAMILY_LIMITS = {
  CHANNEL_MAX: 1023,
  ZONE_MAX: 68,
  RX_GROUP_LISTS_MAX: 76,
  CONTACTS_MAX: 1024,
  ZONE_MEMBERS_MAX: 80,
  RX_GROUP_MEMBERS_MAX: 32,
  /** Channel / zone / contact / talk-group wire name length (LCD limit). */
  NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG: 16,
  /** Binary RX group list name field — 15 bytes (serial codec). */
  RX_GROUP_NAME_LEN: 15,
} as const;
