/**
 * RadioFoundry firmware: limits every board shares (core/codeplug/codeplug.h at 454a5b76).
 * Code mirror of docs/reference/radios/radiofoundry/limits.md. Export boundary only; not library CRUD.
 */
export const RADIOFOUNDRY_LIMITS = {
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
} as const;

/** One inclusive RF band in Hz. */
export interface RadioFoundryBand {
  minHz: number;
  maxHz: number;
}

/** What differs per board running RadioFoundry. One module per board under core/radios/<mfr>/<model>-radiofoundry/. */
export interface RadioFoundryBoardLimits {
  readonly BANDS_HZ: readonly RadioFoundryBand[];
  /**
   * Power levels the board drives (0 in the byte is the radio default). Boards with fewer than
   * nine get the byte scale spread over them.
   */
  readonly POWER_LEVELS: number;
  /**
   * Nominal label per level, lowest first, as the firmware names them. Display only; not used by
   * export maths.
   */
  readonly POWER_LABELS?: readonly string[];
  /** DMR ID database records the cable write may send. */
  readonly ID_DATABASE_MAX: number;
  /** openfw_eeprom: where the board puts image offset 0. A host never sends it. */
  readonly PHYSICAL_CODEPLUG_BASE: number;
  /** openfw_end minus the base: the native codeplug starts here; nothing is written at or past it. */
  readonly IMAGE_END: number;
}

export function isInRadioFoundryBand(hz: number, bands: readonly RadioFoundryBand[]): boolean {
  return bands.some((band) => hz >= band.minHz && hz <= band.maxHz);
}

/** "136-174 and 400-480 MHz", used in export warnings. */
export function formatRadioFoundryBands(bands: readonly RadioFoundryBand[]): string {
  const spans = bands.map((band) => `${band.minHz / 1_000_000}-${band.maxHz / 1_000_000}`);
  return `${spans.join(' and ')} MHz`;
}
