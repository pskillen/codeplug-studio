/**
 * Baofeng DM-32UV running RadioFoundry firmware.
 * Code mirror of [limits.md](../../../../docs/reference/radios/baofeng/dm-32uv-radiofoundry/limits.md).
 * Source of truth for this radio target. No CPS or Web Serial adapter yet — not library CRUD.
 */

export const DM32UV_RADIOFOUNDRY_LIMITS = {
  CHANNEL_MAX: 1024,
  ZONE_MAX: 68,
  ZONE_MEMBERS_MAX: 80,
  /** Talk groups and private contacts share this bank. */
  CONTACTS_MAX: 1024,
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
