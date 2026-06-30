/** Band definitions — mirror docs/reference/bands.md (ranges, colours, notes) */

function frequencyHzToMhz(hz: number | null): number | null {
  if (hz == null || !Number.isFinite(hz)) return null;
  return hz / 1_000_000;
}

export type BandCategory = 'amateur' | 'broadcast' | 'airband' | 'marine' | 'pmr';

export interface BandDefinition {
  id: string;
  label: string;
  minMhz: number;
  maxMhz: number;
  color: string;
  mantine: string;
  category: BandCategory;
  notes?: string;
}

export interface BandSection {
  title: string;
  bands: BandDefinition[];
}

export const UK_AMATEUR_BANDS: BandDefinition[] = [
  {
    id: '136khz',
    label: '136 kHz',
    minMhz: 0.1357,
    maxMhz: 0.1378,
    color: '#6741d9',
    mantine: 'violet.7',
    category: 'amateur',
    notes: 'Full only',
  },
  {
    id: '600m',
    label: '600 m',
    minMhz: 0.472,
    maxMhz: 0.479,
    color: '#1098ad',
    mantine: 'cyan.7',
    category: 'amateur',
    notes: 'Full only',
  },
  {
    id: '160m',
    label: '160 m',
    minMhz: 1.81,
    maxMhz: 2.0,
    color: '#ae3ec9',
    mantine: 'grape.6',
    category: 'amateur',
  },
  {
    id: '80m',
    label: '80 m',
    minMhz: 3.5,
    maxMhz: 3.8,
    color: '#4263eb',
    mantine: 'indigo.6',
    category: 'amateur',
  },
  {
    id: '60m',
    label: '60 m',
    minMhz: 5.2585,
    maxMhz: 5.4065,
    color: '#f59f00',
    mantine: 'yellow.7',
    category: 'amateur',
    notes: 'Simple range lookup',
  },
  {
    id: '40m',
    label: '40 m',
    minMhz: 7.0,
    maxMhz: 7.2,
    color: '#2f9e44',
    mantine: 'green.7',
    category: 'amateur',
  },
  {
    id: '30m',
    label: '30 m',
    minMhz: 10.1,
    maxMhz: 10.15,
    color: '#12b886',
    mantine: 'teal.6',
    category: 'amateur',
    notes: 'Secondary allocation',
  },
  {
    id: '20m',
    label: '20 m',
    minMhz: 14.0,
    maxMhz: 14.35,
    color: '#0ca678',
    mantine: 'teal.7',
    category: 'amateur',
  },
  {
    id: '17m',
    label: '17 m',
    minMhz: 18.068,
    maxMhz: 18.168,
    color: '#099268',
    mantine: 'teal.8',
    category: 'amateur',
  },
  {
    id: '15m',
    label: '15 m',
    minMhz: 21.0,
    maxMhz: 21.45,
    color: '#40c057',
    mantine: 'green.6',
    category: 'amateur',
  },
  {
    id: '12m',
    label: '12 m',
    minMhz: 24.89,
    maxMhz: 24.99,
    color: '#82c91e',
    mantine: 'lime.6',
    category: 'amateur',
  },
  {
    id: '10m',
    label: '10 m',
    minMhz: 28.0,
    maxMhz: 29.7,
    color: '#fab005',
    mantine: 'yellow.6',
    category: 'amateur',
  },
  {
    id: '6m',
    label: '6 m',
    minMhz: 50.0,
    maxMhz: 52.0,
    color: '#fd7e14',
    mantine: 'orange.6',
    category: 'amateur',
  },
  {
    id: '4m',
    label: '4 m',
    minMhz: 70.0,
    maxMhz: 70.5,
    color: '#fcc419',
    mantine: 'yellow.5',
    category: 'amateur',
    notes: 'NoV 70.5–71.5 inherits colour',
  },
  {
    id: '2m',
    label: '2 m',
    minMhz: 144.0,
    maxMhz: 146.0,
    color: '#e03131',
    mantine: 'red.7',
    category: 'amateur',
    notes: 'NoV 146–147 inherits colour',
  },
  {
    id: '70cm',
    label: '70 cm',
    minMhz: 430.0,
    maxMhz: 440.0,
    color: '#339af0',
    mantine: 'blue.5',
    category: 'amateur',
  },
  {
    id: '23cm',
    label: '23 cm',
    minMhz: 1240,
    maxMhz: 1325,
    color: '#7950f2',
    mantine: 'violet.6',
    category: 'amateur',
    notes: 'Radar sharing',
  },
  {
    id: '13cm',
    label: '13 cm',
    minMhz: 2310,
    maxMhz: 2450,
    color: '#868e96',
    mantine: 'gray.6',
    category: 'amateur',
    notes: 'Licence conditions apply',
  },
  {
    id: '9cm',
    label: '9 cm',
    minMhz: 3400,
    maxMhz: 3475,
    color: '#495057',
    mantine: 'gray.7',
    category: 'amateur',
    notes: 'Licence conditions apply',
  },
  {
    id: '6cm',
    label: '6 cm',
    minMhz: 5650,
    maxMhz: 5850,
    color: '#343a40',
    mantine: 'gray.8',
    category: 'amateur',
  },
  {
    id: '3cm',
    label: '3 cm',
    minMhz: 10000,
    maxMhz: 10500,
    color: '#212529',
    mantine: 'gray.9',
    category: 'amateur',
  },
  {
    id: '12cm',
    label: '1.2 cm',
    minMhz: 24000,
    maxMhz: 24250,
    color: '#495057',
    mantine: 'gray.7',
    category: 'amateur',
  },
  {
    id: 'mm',
    label: 'mm+',
    minMhz: 47000,
    maxMhz: 300000,
    color: '#868e96',
    mantine: 'gray.6',
    category: 'amateur',
    notes: 'Upper bound nominal',
  },
];

const SW_BROADCAST_COLOR = '#B8860B';
const SW_BROADCAST_MANTINE = 'yellow.8';

export const SERVICE_BANDS: BandDefinition[] = [
  {
    id: 'broadcast-lw',
    label: 'LW broadcast',
    minMhz: 0.1485,
    maxMhz: 0.285,
    color: '#8B6914',
    mantine: 'orange.9',
    category: 'broadcast',
    notes: 'Not amateur 136 kHz',
  },
  {
    id: 'broadcast-mw',
    label: 'MW broadcast',
    minMhz: 0.5265,
    maxMhz: 1.6065,
    color: '#A67C00',
    mantine: 'orange.8',
    category: 'broadcast',
    notes: 'UK MW broadcast band',
  },
  {
    id: 'broadcast-sw-1',
    label: 'SW broadcast',
    minMhz: 2.001,
    maxMhz: 3.499,
    color: SW_BROADCAST_COLOR,
    mantine: SW_BROADCAST_MANTINE,
    category: 'broadcast',
    notes: 'HF gap (160 m–80 m)',
  },
  {
    id: 'broadcast-sw-2',
    label: 'SW broadcast',
    minMhz: 3.801,
    maxMhz: 5.2584,
    color: SW_BROADCAST_COLOR,
    mantine: SW_BROADCAST_MANTINE,
    category: 'broadcast',
    notes: 'HF gap (80 m–60 m)',
  },
  {
    id: 'broadcast-sw-3',
    label: 'SW broadcast',
    minMhz: 5.4066,
    maxMhz: 6.999,
    color: SW_BROADCAST_COLOR,
    mantine: SW_BROADCAST_MANTINE,
    category: 'broadcast',
    notes: 'HF gap (60 m–40 m)',
  },
  {
    id: 'broadcast-sw-4',
    label: 'SW broadcast',
    minMhz: 7.201,
    maxMhz: 10.099,
    color: SW_BROADCAST_COLOR,
    mantine: SW_BROADCAST_MANTINE,
    category: 'broadcast',
    notes: 'HF gap (40 m–30 m)',
  },
  {
    id: 'broadcast-sw-5',
    label: 'SW broadcast',
    minMhz: 10.151,
    maxMhz: 13.999,
    color: SW_BROADCAST_COLOR,
    mantine: SW_BROADCAST_MANTINE,
    category: 'broadcast',
    notes: 'HF gap (30 m–20 m)',
  },
  {
    id: 'broadcast-sw-6',
    label: 'SW broadcast',
    minMhz: 14.351,
    maxMhz: 18.067,
    color: SW_BROADCAST_COLOR,
    mantine: SW_BROADCAST_MANTINE,
    category: 'broadcast',
    notes: 'HF gap (20 m–17 m)',
  },
  {
    id: 'broadcast-sw-7',
    label: 'SW broadcast',
    minMhz: 18.169,
    maxMhz: 20.999,
    color: SW_BROADCAST_COLOR,
    mantine: SW_BROADCAST_MANTINE,
    category: 'broadcast',
    notes: 'HF gap (17 m–15 m)',
  },
  {
    id: 'broadcast-sw-8',
    label: 'SW broadcast',
    minMhz: 21.451,
    maxMhz: 24.889,
    color: SW_BROADCAST_COLOR,
    mantine: SW_BROADCAST_MANTINE,
    category: 'broadcast',
    notes: 'HF gap (15 m–12 m)',
  },
  {
    id: 'broadcast-sw-9',
    label: 'SW broadcast',
    minMhz: 24.991,
    maxMhz: 27.999,
    color: SW_BROADCAST_COLOR,
    mantine: SW_BROADCAST_MANTINE,
    category: 'broadcast',
    notes: 'HF gap (12 m–10 m)',
  },
  {
    id: 'broadcast-sw-10',
    label: 'SW broadcast',
    minMhz: 29.701,
    maxMhz: 49.999,
    color: SW_BROADCAST_COLOR,
    mantine: SW_BROADCAST_MANTINE,
    category: 'broadcast',
    notes: 'HF gap (10 m–6 m)',
  },
  {
    id: 'fm-broadcast',
    label: 'FM broadcast',
    minMhz: 87.5,
    maxMhz: 108.0,
    color: '#D9480F',
    mantine: 'orange.7',
    category: 'broadcast',
    notes: 'UK FM broadcast band',
  },
  {
    id: 'airband',
    label: 'Airband',
    minMhz: 118.0,
    maxMhz: 137.0,
    color: '#15AABF',
    mantine: 'cyan.6',
    category: 'airband',
    notes: 'Civil aviation VHF AM',
  },
  {
    id: 'marine',
    label: 'Marine',
    minMhz: 156.0,
    maxMhz: 162.05,
    color: '#1864AB',
    mantine: 'blue.8',
    category: 'marine',
    notes: 'ITU marine VHF; ch 16 = 156.800 MHz',
  },
  {
    id: 'pmr446',
    label: 'PMR446',
    minMhz: 446.0,
    maxMhz: 446.2,
    color: '#C2255C',
    mantine: 'pink.7',
    category: 'pmr',
    notes: 'Licence-free; RX-only typical on ham rigs',
  },
];

/** @deprecated Use UK_AMATEUR_BANDS — kept for existing imports */
export const UK_BANDS = UK_AMATEUR_BANDS;

export const ALL_BANDS: BandDefinition[] = [...UK_AMATEUR_BANDS, ...SERVICE_BANDS].sort(
  (a, b) => a.minMhz - b.minMhz || a.maxMhz - b.maxMhz,
);

export const BAND_SECTIONS: BandSection[] = [
  { title: 'Amateur (UK Ofcom allocations)', bands: UK_AMATEUR_BANDS },
  {
    title: 'Broadcast',
    bands: SERVICE_BANDS.filter((b) => b.category === 'broadcast'),
  },
  {
    title: 'PMR and services',
    bands: SERVICE_BANDS.filter((b) => b.category !== 'broadcast'),
  },
];

export const UNKNOWN_BAND_COLOR = '#ced4da';

export function isAmateurBand(band: BandDefinition): boolean {
  return band.category === 'amateur';
}

export function bandFromFrequencyMhz(mhz: number): BandDefinition | null {
  if (!Number.isFinite(mhz) || mhz <= 0) return null;
  for (const band of ALL_BANDS) {
    if (mhz >= band.minMhz && mhz <= band.maxMhz) return band;
  }
  return null;
}

export function bandFromChannel(
  rxFrequency: number | null,
  txFrequency?: number | null,
): BandDefinition | null {
  const bands = bandsFromFrequencies(rxFrequency, txFrequency ?? null);
  return bands[0] ?? null;
}

/** Distinct bands for RX and TX (RX first). Empty when neither frequency classifies. */
export function bandsFromFrequencies(
  rxFrequency: number | null,
  txFrequency: number | null,
): BandDefinition[] {
  const bands: BandDefinition[] = [];
  const seen = new Set<string>();

  for (const hz of [rxFrequency, txFrequency]) {
    const mhz = frequencyHzToMhz(hz);
    if (mhz == null) continue;
    const band = bandFromFrequencyMhz(mhz);
    if (band && !seen.has(band.id)) {
      seen.add(band.id);
      bands.push(band);
    }
  }

  return bands;
}

export function channelMatchesBandFilter(
  rxFrequency: number | null,
  txFrequency: number | null,
  bandIds: string[],
): boolean {
  if (!bandIds.length) return true;
  return bandsFromFrequencies(rxFrequency, txFrequency).some((b) => bandIds.includes(b.id));
}

export function frequencyOffsetMhz(
  rxFrequency: number | null,
  txFrequency: number | null,
): number | null {
  const rx = frequencyHzToMhz(rxFrequency);
  const tx = frequencyHzToMhz(txFrequency);
  if (rx == null || tx == null) return null;
  return tx - rx;
}

export function bandsFromFrequenciesHz(
  rxFrequencyHz: number | null,
  txFrequencyHz: number | null,
): BandDefinition[] {
  return bandsFromFrequencies(rxFrequencyHz, txFrequencyHz);
}

/** Map ukrepeater.net / BrandMeister wire band codes (e.g. `2M`, `70CM`) to a pill definition. */
export function bandFromWireLabel(wire: string): BandDefinition | null {
  const normalised = wire.trim().toUpperCase().replace(/\s+/g, '');
  if (!normalised) return null;

  const byId = ALL_BANDS.find((b) => b.id === normalised.toLowerCase());
  if (byId) return byId;

  const aliases: Record<string, string> = {
    '2M': '2m',
    '70CM': '70cm',
    '23CM': '23cm',
    '4M': '4m',
    '6M': '6m',
    '10M': '10m',
    '20M': '20m',
    '40M': '40m',
    '80M': '80m',
    '160M': '160m',
  };
  const id = aliases[normalised];
  if (id) return ALL_BANDS.find((b) => b.id === id) ?? null;

  return ALL_BANDS.find((b) => b.label.toUpperCase().replace(/\s+/g, '') === normalised) ?? null;
}

export function bandsForRepeaterListing(
  rxFrequencyHz: number | null,
  txFrequencyHz: number | null,
  wireBand: string,
): BandDefinition[] {
  const fromFreq = bandsFromFrequencies(rxFrequencyHz, txFrequencyHz);
  if (fromFreq.length > 0) return fromFreq;
  const fromWire = bandFromWireLabel(wireBand);
  return fromWire ? [fromWire] : [];
}
