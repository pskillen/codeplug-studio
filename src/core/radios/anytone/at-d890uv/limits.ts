/**
 * Anytone AT-D890UV hardware limits.
 * Code mirror of [limits.md](../../../../docs/reference/radios/anytone/at-d890uv/limits.md).
 * Used by CPS export adapters and Web Serial codecs — not library CRUD.
 */

export const AT_D890UV_LIMITS = {
  CHANNEL_MAX: 4000,
  ZONE_MAX: 250,
  ZONE_MEMBERS_MAX: 250,
  SCAN_LISTS_MAX: 250,
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
   * pair, #856/#1068). The D890 CPS writes a fixed table of this many records at
   * `0x4A80000`–`0x4A831FF` and does not write `0x4A83200`–`0x4A863FF`. See
   * docs/reference/radios/anytone/at-d890uv/satellite-keps.md and limits.md.
   */
  SATELLITE_MAX: 25,
  /** 8-byte ASCII name field at record offset 0x00 — see satellite-keps.md. */
  SATELLITE_NAME_LENGTH: 8,
  /** Digital contact bank — vendor programming guide (500k lookup table). */
  DIGITAL_CONTACTS_MAX: 500_000,
} as const;
