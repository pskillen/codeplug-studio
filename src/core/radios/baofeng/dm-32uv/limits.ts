/**
 * Baofeng DM-32UV / DP570UV hardware limits.
 * Code mirror of [limits.md](../../../../docs/reference/radios/baofeng/dm-32uv/limits.md).
 * Used by CPS export adapters and Web Serial codecs — not library CRUD.
 */

export const DM32UV_LIMITS = {
  CHANNEL_MAX: 4000,
  ZONE_MAX: 250,
  ZONE_MEMBERS_MAX: 64,
  /** EEPROM scan-list bank size. */
  SCAN_LISTS_MAX: 32,
  /** Channel record `scanListId` is 4 bits (0 = none) → max 15 referenceable lists. */
  CHANNEL_SCAN_LIST_ID_MAX: 15,
  /** Named CSV scan-list members; CPS “16” includes implicit current channel. */
  SCAN_LIST_MEMBERS_MAX: 15,
  /** RX group bank size (metadata 0x0F). */
  RX_GROUPS_MAX: 32,
  RX_GROUP_MEMBERS_MAX: 32,
  CONTACTS_MAX: 250,
  TALK_GROUPS_MAX: 800,
  RADIO_IDS_MAX: 250,
  /** Channel / zone / contact / talk-group wire name length (LCD limit). */
  NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG: 16,
  /** Max `Scan.csv` Scan Name length (conservative vs CPS official 11). */
  NAME_LENGTH_SCAN_LIST: 10,
  /** Max `RXGroupLists.csv` / binary RX group name length. */
  NAME_LENGTH_RX_GROUP_LIST: 10,
  /** DM-32 CPS APRS report-channel slots (NeonPlug + APRS.md guide). */
  APRS_REPORT_CHANNELS: 8,
  /** NO-TX band: RX 87–136 MHz exclusive upper bound (Hz). */
  NO_TX_BAND_RX_MIN_HZ: 87_000_000,
  NO_TX_BAND_RX_MAX_HZ: 136_000_000,
  /** Effective scan inclusion when channel + build omit override (DM32 / NeonPlug convention). */
  DEFAULT_SCAN_INCLUSION: 'scan',
} as const;
