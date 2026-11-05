/**
 * Baofeng DM-32UV running RadioFoundry firmware.
 * Code mirror of [limits.md](../../../../docs/reference/radios/baofeng/dm-32uv-radiofoundry/limits.md).
 * Source of truth for this radio target. The codeplug exporter reads these caps. Not library CRUD.
 */

export const DM32UV_RADIOFOUNDRY_LIMITS = {
  CHANNEL_MAX: 1024,
  ZONE_MAX: 68,
  ZONE_MEMBERS_MAX: 80,
  /** Talk groups and private contacts share this bank. */
  CONTACTS_MAX: 1024,
  /**
   * Records the DMR ID database holds: area 1 (`0x40000` bytes less the 12-byte header) plus the
   * part of area 2 that ends at the native codeplug, at 27 bytes a record. Derived from the
   * layout in `integrations/radio-io/radios/dm32uv-radiofoundry/idDatabase.ts`, which has a test
   * pinning the two together.
   */
  ID_DATABASE_MAX: 287_629,
  RX_GROUPS_MAX: 76,
  RX_GROUP_MEMBERS_MAX: 32,
  /** Channel, zone, contact, and talk-group name length. */
  NAME_MAX: 16,
  /** Radio name length. */
  RADIO_NAME_MAX: 8,
  /** One radio DMR ID. */
  RADIO_IDS_MAX: 1,
  /** Maximum value of that DMR ID. */
  DMR_ID_MAX: 16_776_415,
  /** Power steps. Watt values are unmeasured. */
  POWER_LEVELS: 9,
} as const;
