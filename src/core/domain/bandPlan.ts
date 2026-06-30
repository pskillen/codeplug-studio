/**
 * Amateur (and a few common non-amateur) frequency band lookups, for
 * programming convenience only — not authoritative for on-air operation.
 * Vendor-neutral RF domain reference; no CPS/format concerns.
 */

export interface BandAllocation {
  /** Short label, e.g. "2M". */
  label: string;
  /** Human name, e.g. "2 metres (VHF)". */
  name: string;
  startHz: number;
  endHz: number;
  service: 'amateur' | 'other';
}

const MHZ = 1_000_000;

export const BAND_PLAN: BandAllocation[] = [
  {
    label: '160M',
    name: '160 metres (MF)',
    startHz: 1.81 * MHZ,
    endHz: 2.0 * MHZ,
    service: 'amateur',
  },
  {
    label: '80M',
    name: '80 metres (HF)',
    startHz: 3.5 * MHZ,
    endHz: 3.8 * MHZ,
    service: 'amateur',
  },
  {
    label: '60M',
    name: '60 metres (HF)',
    startHz: 5.2585 * MHZ,
    endHz: 5.4065 * MHZ,
    service: 'amateur',
  },
  {
    label: '40M',
    name: '40 metres (HF)',
    startHz: 7.0 * MHZ,
    endHz: 7.2 * MHZ,
    service: 'amateur',
  },
  {
    label: '30M',
    name: '30 metres (HF)',
    startHz: 10.1 * MHZ,
    endHz: 10.15 * MHZ,
    service: 'amateur',
  },
  {
    label: '20M',
    name: '20 metres (HF)',
    startHz: 14.0 * MHZ,
    endHz: 14.35 * MHZ,
    service: 'amateur',
  },
  {
    label: '17M',
    name: '17 metres (HF)',
    startHz: 18.068 * MHZ,
    endHz: 18.168 * MHZ,
    service: 'amateur',
  },
  {
    label: '15M',
    name: '15 metres (HF)',
    startHz: 21.0 * MHZ,
    endHz: 21.45 * MHZ,
    service: 'amateur',
  },
  {
    label: '12M',
    name: '12 metres (HF)',
    startHz: 24.89 * MHZ,
    endHz: 24.99 * MHZ,
    service: 'amateur',
  },
  {
    label: '10M',
    name: '10 metres (HF)',
    startHz: 28.0 * MHZ,
    endHz: 29.7 * MHZ,
    service: 'amateur',
  },
  {
    label: '6M',
    name: '6 metres (VHF)',
    startHz: 50.0 * MHZ,
    endHz: 52.0 * MHZ,
    service: 'amateur',
  },
  {
    label: '4M',
    name: '4 metres (VHF)',
    startHz: 70.0 * MHZ,
    endHz: 70.5 * MHZ,
    service: 'amateur',
  },
  {
    label: 'Airband',
    name: 'VHF airband',
    startHz: 108.0 * MHZ,
    endHz: 137.0 * MHZ,
    service: 'other',
  },
  {
    label: '2M',
    name: '2 metres (VHF)',
    startHz: 144.0 * MHZ,
    endHz: 148.0 * MHZ,
    service: 'amateur',
  },
  {
    label: 'Marine VHF',
    name: 'Marine VHF',
    startHz: 156.0 * MHZ,
    endHz: 162.025 * MHZ,
    service: 'other',
  },
  { label: 'PMR446', name: 'PMR446', startHz: 446.0 * MHZ, endHz: 446.2 * MHZ, service: 'other' },
  {
    label: '70CM',
    name: '70 centimetres (UHF)',
    startHz: 430.0 * MHZ,
    endHz: 440.0 * MHZ,
    service: 'amateur',
  },
  {
    label: '23CM',
    name: '23 centimetres (UHF)',
    startHz: 1240.0 * MHZ,
    endHz: 1325.0 * MHZ,
    service: 'amateur',
  },
];

/** Find the band allocation containing a frequency in Hz, or null. */
export function bandForFrequencyHz(hz: number | null): BandAllocation | null {
  if (hz === null || !Number.isFinite(hz)) return null;
  return BAND_PLAN.find((b) => hz >= b.startHz && hz < b.endHz) ?? null;
}

/** Short band label for a frequency, or "—" when unknown. */
export function bandLabelForFrequencyHz(hz: number | null): string {
  return bandForFrequencyHz(hz)?.label ?? '—';
}
