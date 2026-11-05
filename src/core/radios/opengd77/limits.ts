/**
 * OpenGD77 / OpenUV380 family hardware limits (DM-1701, MD-9600, …).
 * Code mirror of tier-3 radio docs under docs/reference/radios/.
 * Used by CPS export adapters and Web Serial codecs — not library CRUD.
 */

/**
 * User Database FLASH geometry (DM-1701 and MD-9600, 16 MiB W25Q128). Firmware `uiUtilities.c`
 * `dmrIDCacheInit` / `dmrIDReadContactInFlash`: segment 0 sits after a 12-byte header and holds
 * whole entries up to 0x40000 bytes; segment 1 starts at 0xD8000 and is unbounded in the firmware,
 * so the ceiling is whatever sits above it. The GPS log owns the last 2 MiB (`gps.c`
 * `LOG_FLASH_16MB_START_ADDRESS`, 14 MiB). Voice prompts live at 0xAF400, or in the legacy slot at
 * 0x100000, which a long segment 1 then overwrites. Mode byte `'N'`: 27-byte entries, 3-byte IDs.
 */
export const OPENUV380_USER_DB_GEOMETRY = {
  HEADER_ABS: 0x0005_0000,
  HEADER_SIZE: 12,
  /** Bytes from the header base that segment 0 may fill (header included). */
  SEGMENT0_SIZE: 0x0004_0000,
  SEGMENT1_ABS: 0x000d_8000,
  /** `0x4A` + 27 on the wire; `'N'` mode, 6-bit packed text. */
  ENTRY_SIZE: 0x1b,
  /** First byte of the GPS log; nothing may be written at or above it. */
  FLASH_WRITE_LIMIT_ABS: 14 * 1024 * 1024,
  /** Where older installs keep the voice prompts (read only when 0xAF400 has none). */
  LEGACY_VOICE_PROMPTS_ABS: 0x0010_0000,
} as const;

/** Whole entries segment 0 holds. */
export const OPENUV380_USER_DB_SEGMENT0_ENTRIES = Math.floor(
  (OPENUV380_USER_DB_GEOMETRY.SEGMENT0_SIZE - OPENUV380_USER_DB_GEOMETRY.HEADER_SIZE) /
    OPENUV380_USER_DB_GEOMETRY.ENTRY_SIZE,
);

/** Entries that fit when everything below `endAbs` is available (segment 0 plus segment 1 up to `endAbs`). */
export function openUv380UserDatabaseCapacity(endAbs: number): number {
  const g = OPENUV380_USER_DB_GEOMETRY;
  return (
    OPENUV380_USER_DB_SEGMENT0_ENTRIES +
    Math.max(0, Math.floor((endAbs - g.SEGMENT1_ABS) / g.ENTRY_SIZE))
  );
}

export const OPENGD77_FAMILY_LIMITS = {
  CHANNEL_MAX: 1023,
  ZONE_MAX: 68,
  RX_GROUP_LISTS_MAX: 76,
  CONTACTS_MAX: 1024,
  /**
   * Firmware User Database (call-sign / DMR ID lookup) ceiling, derived from the FLASH layout:
   * segment 0 plus segment 1 up to the GPS log. Not the 1024-slot DMR contact bank. Not qdmr `size1`.
   * A Write holds it to the lower caps below when the radio cannot be confirmed as 16 MiB or its
   * voice prompts sit in the legacy slot.
   */
  USER_DATABASE_MAX: openUv380UserDatabaseCapacity(
    OPENUV380_USER_DB_GEOMETRY.FLASH_WRITE_LIMIT_ABS,
  ),
  /** The cap while voice prompts live in the legacy slot: segment 1 must stop below it. */
  USER_DATABASE_MAX_LEGACY_VOICE_PROMPTS: openUv380UserDatabaseCapacity(
    OPENUV380_USER_DB_GEOMETRY.LEGACY_VOICE_PROMPTS_ABS,
  ),
  /**
   * The cap the Write uses when the radio does not report the 16 MiB flash part: the older, tested
   * size (user-guide upper range for callsign-only entries).
   */
  USER_DATABASE_MAX_UNCONFIRMED_FLASH: 69_600,
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
