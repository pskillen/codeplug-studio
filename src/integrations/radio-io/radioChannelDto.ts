/**
 * Shared radio-boundary channel DTO — no library UUIDs.
 * App maps AssembledChannel ↔ this shape; radio modules encode/decode only.
 */

export type RadioTone =
  { kind: 'none' } | { kind: 'ctcss'; hz: number } | { kind: 'dcs'; code: number; polarity?: 'N' | 'I' };

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
}
