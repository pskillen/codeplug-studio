/**
 * Amateur (and common non-amateur) frequency band lookups, for
 * programming convenience only — not authoritative for on-air operation.
 * Vendor-neutral RF domain reference; no CPS/format concerns.
 */

import {
  ALL_BANDS,
  type BandCategory,
  type BandDefinition,
  type BandSection,
  BAND_SECTIONS,
  bandFromFrequencyMhz,
  SERVICE_BANDS,
  UK_AMATEUR_BANDS,
  UK_BANDS,
  UNKNOWN_BAND_COLOR,
} from './bandCatalog.ts';

export type { BandCategory, BandDefinition, BandSection };
export {
  ALL_BANDS,
  BAND_SECTIONS,
  SERVICE_BANDS,
  UK_AMATEUR_BANDS,
  UK_BANDS,
  UNKNOWN_BAND_COLOR,
  bandFromFrequencyMhz,
};

const MHZ = 1_000_000;

/** @deprecated Use BandDefinition from bandCatalog — kept for summary/report compatibility. */
export interface BandAllocation {
  label: string;
  name: string;
  startHz: number;
  endHz: number;
  service: 'amateur' | 'other';
}

/** @deprecated Use ALL_BANDS from bandCatalog. */
export const BAND_PLAN: BandAllocation[] = ALL_BANDS.map((band) => ({
  label: band.label,
  name: band.label,
  startHz: band.minMhz * MHZ,
  endHz: band.maxMhz * MHZ,
  service: band.category === 'amateur' ? 'amateur' : 'other',
}));

function bandDefinitionForFrequencyHz(hz: number): BandDefinition | null {
  const mhz = hz / MHZ;
  return bandFromFrequencyMhz(mhz);
}

/** Find the band allocation containing a frequency in Hz, or null. */
export function bandForFrequencyHz(hz: number | null): BandAllocation | null {
  if (hz === null || !Number.isFinite(hz)) return null;
  const band = bandDefinitionForFrequencyHz(hz);
  if (!band) return null;
  return {
    label: band.label,
    name: band.label,
    startHz: band.minMhz * MHZ,
    endHz: band.maxMhz * MHZ,
    service: band.category === 'amateur' ? 'amateur' : 'other',
  };
}

/** Short band label for a frequency, or "—" when unknown. */
export function bandLabelForFrequencyHz(hz: number | null): string {
  return bandForFrequencyHz(hz)?.label ?? '—';
}
