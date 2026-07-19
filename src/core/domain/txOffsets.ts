/**
 * Common TX offsets by band — vendor-neutral RF domain helpers for channel edit UI.
 * Not authoritative for on-air operation; programming convenience only.
 */

import { bandFromFrequencyMhz } from './bandCatalog.ts';

export interface TxOffsetOption {
  label: string;
  offsetMhz: number;
}

/** Epsilon for matching computed offset to a quick-button option (Hz-scale MHz float). */
export const TX_OFFSET_MATCH_EPSILON_MHZ = 0.0005;

const SIMPLEX: TxOffsetOption = { label: 'Simplex', offsetMhz: 0 };

/**
 * Common repeater / duplex offsets keyed by band catalog id.
 * Bands not listed get Simplex only until documented in docs/reference/tx-offsets.md.
 */
export const TX_OFFSETS_BY_BAND_ID: Readonly<Record<string, readonly TxOffsetOption[]>> = {
  '2m': [SIMPLEX, { label: '−0.6 MHz', offsetMhz: -0.6 }],
  '70cm': [
    SIMPLEX,
    { label: '+7.6 MHz', offsetMhz: 7.6 },
    { label: '+9.0 MHz', offsetMhz: 9.0 },
  ],
};

const DEFAULT_OFFSETS: readonly TxOffsetOption[] = [SIMPLEX];

function hzToMhz(hz: number | null): number | null {
  if (hz == null || !Number.isFinite(hz)) return null;
  return hz / 1_000_000;
}

/** TX − RX in MHz, or null when either frequency is missing. */
export function frequencyOffsetMhz(
  rxFrequencyHz: number | null,
  txFrequencyHz: number | null,
): number | null {
  const rx = hzToMhz(rxFrequencyHz);
  const tx = hzToMhz(txFrequencyHz);
  if (rx == null || tx == null) return null;
  return tx - rx;
}

/**
 * Format offset for display: `===` (simplex), `+X.XXX MHz`, or `-X.XXX MHz`.
 * Returns null when offset is null.
 */
export function formatOffsetMhz(offsetMhz: number | null): string | null {
  if (offsetMhz == null || !Number.isFinite(offsetMhz)) return null;
  if (Math.abs(offsetMhz) < TX_OFFSET_MATCH_EPSILON_MHZ) return '===';
  const abs = Math.abs(offsetMhz);
  const formatted = abs.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return `${offsetMhz > 0 ? '+' : '-'}${formatted} MHz`;
}

export function offsetsMatch(a: number, b: number, epsilon = TX_OFFSET_MATCH_EPSILON_MHZ): boolean {
  return Math.abs(a - b) < epsilon;
}

/** Quick-offset options for the band containing RX (Simplex-only when band unknown/undocumented). */
export function txOffsetsForFrequencyHz(rxFrequencyHz: number | null): readonly TxOffsetOption[] {
  const mhz = hzToMhz(rxFrequencyHz);
  if (mhz == null) return DEFAULT_OFFSETS;
  const band = bandFromFrequencyMhz(mhz);
  if (!band) return DEFAULT_OFFSETS;
  return TX_OFFSETS_BY_BAND_ID[band.id] ?? DEFAULT_OFFSETS;
}

/** Apply offset to RX Hz → TX Hz (rounded to integer Hz). */
export function txFrequencyHzFromOffset(
  rxFrequencyHz: number,
  offsetMhz: number,
): number {
  return Math.round(rxFrequencyHz + offsetMhz * 1_000_000);
}
