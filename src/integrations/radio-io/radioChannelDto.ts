/**
 * Shared radio-boundary channel DTO — no library UUIDs.
 * App maps AssembledChannel ↔ this shape; radio modules encode/decode only.
 */

export type RadioTone =
  | { kind: 'none' }
  | { kind: 'ctcss'; hz: number }
  | { kind: 'dcs'; code: number; polarity?: 'N' | 'I' };

export type RadioChannelMode = 'analog' | 'digital' | 'fixed-analog' | 'fixed-digital';

/**
 * One memory slot as seen by clone-image radios.
 * `slotIndex` is **1-based** (matches CPS Location / NeonPlug channel number).
 */
export interface RadioChannelDto {
  /** 1-based memory slot. */
  slotIndex: number;
  /** Empty slot — encode as 0xFF fill for Mini / DM-32. */
  empty: boolean;
  /** Wire/display name (profile length limits applied by assemble / app). */
  wireName: string;
  rxHz: number;
  txHz: number;
  rxTone: RadioTone;
  txTone: RadioTone;
  /** Internal power 0–100, or null for radio default. */
  powerPercent: number | null;
  /** FM wideband vs NFM narrow. */
  bandwidth: 'FM' | 'NFM';
  /** Optional DMR / dual-mode fields (DM-32UV, …). Mini leaves these undefined. */
  mode?: RadioChannelMode;
  colorCode?: number;
  timeslot?: 1 | 2;
  /** TX contact / talk-group index from TX-contact blocks (1-based contact id when digital). */
  txContactId?: number;
  /** RX group list index (0-based / radio-native). */
  rxGroupIndex?: number;
  /**
   * Scan list id on channel record (1–32); bit-packed into byte 0x19 bits 5–2.
   * Undefined = leave scan-list id unset (0).
   */
  scanListId?: number;
  /** When true, set scan-add bit (0x19 bit 6). */
  scanAdd?: boolean;
  /** Channel APRS receive (0x1A bit 2). */
  aprsReceive?: boolean;
  /** Channel APRS report mode (0x35 on D890; 0x1C bits 3–2 on DM-32). */
  aprsReportMode?: 'off' | 'digital' | 'analog';
  /** D890 digital APRS PTT @ `0x37`. */
  aprsDigitalPttMode?: 'off' | 'on';
  /** D890 digital report slot — 1-based into global APRS slots (`0x38` is 0-based). */
  aprsReportSlotIndex?: number | null;
  /**
   * OpenGD77 analogue squelch @ `0x37` — internal percent 1–100, or `null` for Global.
   * Ignored on encode when `mode` is digital / fixed-digital (qdmr: no per-channel squelch).
   */
  squelchPercent?: number | null;
  /** OpenGD77: skipScan bit @ 0x33 bit 4. */
  skipScan?: boolean;
  /** OpenGD77: skipZoneScan bit @ 0x33 bit 5. */
  skipZoneScan?: boolean;
  /** OpenGD77 / DM-32 / UV-5R Mini: RX-only (forbid TX). */
  rxOnly?: boolean;
  /** DM-32UV: 0-based operator radio-ID bank index; omit or 0xFF on wire when unset. */
  dmrRadioIdIndex?: number;
  /**
   * OpenGD77 channel GPS — split packed-angle bytes in the 0x38 record.
   * `null` when unset / all-zero on wire without Use Location flag.
   */
  location?: { lat: number; lon: number } | null;
  /** OpenGD77 LibreDMR_flag1 @ `0x26` bit 3 (`0x08`) — distance-from-repeater / roaming. */
  useLocation?: boolean;
}
