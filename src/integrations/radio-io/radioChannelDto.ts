/**
 * Shared radio-boundary channel DTO — no library UUIDs.
 * App maps AssembledChannel ↔ this shape; radio modules encode/decode only.
 */

import type { DmrOperatingMode } from '@core/models/libraryTypes.ts';

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
  /**
   * DMR operating mode for radios that store repeater vs DMO on the channel record
   * (Anytone `0x21` bits 2–3). Omit on analog-only rows.
   */
  dmrOperatingMode?: DmrOperatingMode;
  /** TX contact / talk-group index from TX-contact blocks (1-based contact id when digital). */
  txContactId?: number;
  /** RX group list index (0-based / radio-native). */
  rxGroupIndex?: number;
  /**
   * 1-based scan-list id in byte 0x19 bits 5–0 (0 = none, max 32 on DM-32UV).
   * Undefined encodes as 0. Bit 6 is scan-add; bit 7 is bandwidth.
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
   * OpenGD77: this channel's own DMR ID (the number), written to `0x27` with the override flag.
   * Omit for Default (`0x27` = 0: the radio's own ID).
   */
  dmrId?: number;
  /**
   * Channel position. OpenGD77: split packed-angle bytes in the 0x38 record (`null` when
   * unset / all-zero on wire without Use Location flag). AT-D890UV / DM-32UV MM9PDY targets:
   * the channel location table entry for this slot (stamped only when
   * `organisation.writeChannelLocationTable` is set; stock projections omit it).
   */
  location?: { lat: number; lon: number } | null;
  /**
   * OpenGD77 LibreDMR_flag1 @ `0x26` bit 3 (`0x08`) — distance-from-repeater / roaming.
   * MM9PDY AT-D890UV / DM-32UV: the slot gets a table entry only when this is true.
   */
  useLocation?: boolean;
  /**
   * NXDN channel fields. AT-D890UV MM9PDY only, and only when the radio reports NXDN enabled;
   * stock projections and every other radio never set it. Present (possibly empty) marks a
   * channel that has an NXDN profile; an absent value inside leaves that byte as read.
   */
  nxdn?: RadioChannelNxdnDto;
  /**
   * AT-D890UV MM9PDY only: write zeros into the NXDN bytes `0x66`-`0x6E` of a channel that has no
   * {@link nxdn} fields, so a previous occupant's bytes (or an erased slot's `FF`) cannot make a
   * DMR or analogue channel look NXDN-capable. Stock projections never set it (carried over).
   */
  clearNxdnBytes?: boolean;
}

/** NXDN rate: 6.25 kHz (NXDN48) or 12.5 kHz (NXDN96). */
export type RadioNxdnRate = 'nxdn48' | 'nxdn96';

export interface RadioChannelNxdnDto {
  /** Receive RAN, 0-63. */
  rxRan?: number;
  /** Transmit RAN, 0-63. */
  txRan?: number;
  rate?: RadioNxdnRate;
  /**
   * 0-based slot in the radio's NXDN list the channel calls (a talk group or contact written by
   * this Write). Absent: no call target (PTT Call off).
   */
  txTargetIndex?: number;
  /** 0-based NXDN RX group list. Absent: none (`0xFF`). */
  rxGroupIndex?: number;
}
