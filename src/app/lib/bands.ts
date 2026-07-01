/** Band UI helpers — catalog data lives in @core/domain/bandCatalog.ts */

import {
  ALL_BANDS,
  BAND_SECTIONS,
  SERVICE_BANDS,
  UK_AMATEUR_BANDS,
  UK_BANDS,
  UNKNOWN_BAND_COLOR,
  bandFromFrequencyMhz,
  isAmateurBand,
  type BandDefinition,
} from '@core/domain/bandCatalog.ts';

export type { BandCategory, BandDefinition, BandSection } from '@core/domain/bandCatalog.ts';
export {
  ALL_BANDS,
  BAND_SECTIONS,
  SERVICE_BANDS,
  UK_AMATEUR_BANDS,
  UK_BANDS,
  UNKNOWN_BAND_COLOR,
  bandFromFrequencyMhz,
  isAmateurBand,
};

function frequencyHzToMhz(hz: number | null): number | null {
  if (hz == null || !Number.isFinite(hz)) return null;
  return hz / 1_000_000;
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
