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
  /**
   * Firmware User Database (call-sign / DMR ID lookup) — preliminary upper bound
   * from the OpenGD77 user guide (~13800-69600 by chars/entry). Packing may
   * yield fewer. Not the 1024-slot DMR contact bank. Not qdmr `size1`.
   */
  USER_DATABASE_MAX: 69_600,
  ZONE_MEMBERS_MAX: 80,
  RX_GROUP_MEMBERS_MAX: 32,
  /** Channel / zone / contact / talk-group wire name length (LCD limit). */
  NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG: 16,
  /** Binary RX group list name field — 15 bytes (serial codec). */
  RX_GROUP_NAME_LEN: 15,
  /**
   * Satellite keps bank — one wire record per spacecraft (not per transmitter).
   * qdmr `SatelliteBankElement::Limit::satellites()`; see
   * docs/reference/radios/opengd77/satellite-orbitals.md.
   */
  SATELLITE_MAX: 25,
  /** ASCII name field in each `SatelliteElement` (8 bytes, pad `0x00`). */
  SATELLITE_NAME_LENGTH: 8,
  /** APRS path field in each `SatelliteElement` (qdmr encode currently leaves zeros). */
  SATELLITE_APRS_PATH_LENGTH: 24,
} as const;
