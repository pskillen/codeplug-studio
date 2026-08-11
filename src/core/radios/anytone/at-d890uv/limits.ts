/**
 * Anytone AT-D890UV hardware limits.
 * Code mirror of [limits.md](../../../../docs/reference/radios/anytone/at-d890uv/limits.md).
 * Used by CPS export adapters and Web Serial codecs — not library CRUD.
 */

export const AT_D890UV_LIMITS = {
  CHANNEL_MAX: 4000,
  ZONE_MAX: 250,
  ZONE_MEMBERS_MAX: 250,
  SCAN_LISTS_MAX: 100,
  SCAN_LIST_MEMBERS_MAX: 100,
  RX_GROUP_LISTS_MAX: 250,
  RX_GROUP_MEMBERS_MAX: 64,
  TALK_GROUPS_MAX: 10_000,
  NAME_LENGTH: 16,
  APRS_SLOTS: 8,
  /** Parallel AM airband bank (AmAirData) — not MR channels. */
  AM_AIR_CHANNEL_MAX: 256,
  /** Parallel AM airband zones (AmZoneData). */
  AM_ZONE_MAX: 16,
  /** AmZone member slots — narrower than DMR ZONE_MEMBERS_MAX. */
  AM_ZONE_MEMBERS_MAX: 32,
  /**
   * Satellite keps write cap — this is a **transmitter/record** cap, not a satellite cap
   * (`packSatelliteWriteRecords` emits one wire record per eligible `(satellite, transmitter)`
   * pair, #856/#1068). No D890 firmware ceiling is known — anytone-cps's own
   * `SatelliteTableModel`/`writeSatelliteData()` iterate an unbounded list. `50` is a
   * Studio-chosen placeholder roughly midway between qdmr's smallest (D168UV, 25) and largest
   * (DMR6X2UV, 200) declared Anytone-family satellite caps — not itself hardware-verified, and
   * not a more confident number than the previous `25` placeholder it replaces. See
   * docs/reference/radios/anytone/at-d890uv/satellite-keps.md ("Max satellite count").
   */
  SATELLITE_MAX: 50,
} as const;
