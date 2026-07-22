/**
 * Shared radio-boundary channel DTO — no library UUIDs.
 * App maps AssembledChannel ↔ this shape; radio modules encode/decode only.
 */

export type RadioTone =
  | { kind: 'none' }
  | { kind: 'ctcss'; hz: number }
  | { kind: 'dcs'; code: number };

/**
 * One memory slot as seen by clone-image radios.
 * `slotIndex` is **1-based** (matches CPS Location / NeonPlug channel number).
 */
export interface RadioChannelDto {
  /** 1-based memory slot. */
  slotIndex: number;
  /** Empty slot — encode as 0xFF fill for Mini. */
  empty: boolean;
  /** Wire/display name (profile length limits applied by assemble / app). */
  wireName: string;
  rxHz: number;
  txHz: number;
  rxTone: RadioTone;
  txTone: RadioTone;
  /** Internal power 0–100, or null for radio default (maps to High on Mini). */
  powerPercent: number | null;
  /** FM wideband vs NFM narrow — Mini wide bit polarity: 1 = NFM. */
  bandwidth: 'FM' | 'NFM';
}
