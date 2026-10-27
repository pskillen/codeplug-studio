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
  /**
   * NXDN talk-group / contact list (one list, talk groups first). The index table holds 1000 u32
   * slots and the record bank is one 1000-record bank (firmware RE, NXDN codeplug).
   */
  NXDN_LIST_MAX: 1000,
  /** NXDN RX group lists (the radio's NXDN RX group unit: 250 strides of `0x200`). */
  NXDN_RX_GROUP_LISTS_MAX: 250,
  /** Members per NXDN RX group list: 64 u32 slots, stored contiguously. */
  NXDN_RX_GROUP_MEMBERS_MAX: 64,
  /** NXDN list and RX group list names: 16 characters (UTF-16, NUL-terminated on the wire). */
  NXDN_NAME_MAX: 16,
  /** Operator radio-ID list entries (the master ID is separate). */
  RADIO_IDS_MAX: 250,
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

/** Per-code RX/TX range table (LocalInfo +0x03): see frequencyRange.ts. */
export {
  AT_D890_FREQUENCY_RANGES,
  atD890MaintenanceUnlocked,
  atD890TxAllowed,
  describeAtD890FrequencyRange,
  listAtD890ReceiveOnlyChannels,
} from './frequencyRange.ts';
export type {
  AtD890DescribeOptions,
  AtD890FrequencyRangeDescription,
  AtD890FrequencyRangeRow,
  AtD890MhzRange,
  AtD890RangeCheckChannel,
} from './frequencyRange.ts';
