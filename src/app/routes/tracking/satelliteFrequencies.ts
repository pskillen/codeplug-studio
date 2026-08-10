import type { SatelliteEnrichment } from '@core/models/satelliteEnrichment.ts';
import { hzToMhzString } from '../../lib/units.ts';
import type { SatellitePassBaseRow, SatellitePassRow } from './useTrackingPasses.ts';

/**
 * Stop-gap until SatNOGS enrichment merges uplink/downlink onto `Satellite` (#864): the pass
 * grid reads frequencies from both the library satellite record and session-scoped SatNOGS
 * transmitter rows, and treats either source as sufficient for the "has frequencies" filter.
 */
export interface PassFrequencyFields {
  hasFrequencies: boolean;
  /** Operator TX — satellite uplink centre frequency. */
  txDisplay: string;
  /** Operator RX — satellite downlink centre frequency. */
  rxDisplay: string;
  txSortHz: number | null;
  rxSortHz: number | null;
}

function uniqueMhzLabels(hzValues: number[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const hz of hzValues) {
    const label = `${hzToMhzString(hz)} MHz`;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

function collectSatnogsUplinkHz(enrichment: SatelliteEnrichment | null): number[] {
  if (!enrichment) return [];
  return enrichment.transmitters
    .map((transmitter) => transmitter.uplinkHz)
    .filter((hz): hz is number => hz !== null);
}

function collectSatnogsDownlinkHz(enrichment: SatelliteEnrichment | null): number[] {
  if (!enrichment) return [];
  return enrichment.transmitters
    .map((transmitter) => transmitter.downlinkHz)
    .filter((hz): hz is number => hz !== null);
}

function formatFrequencyColumn(
  satelliteHz: number | null | undefined,
  satnogsHz: number[],
): string {
  const parts = uniqueMhzLabels(satelliteHz != null ? [satelliteHz, ...satnogsHz] : satnogsHz);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function firstSortHz(satelliteHz: number | null | undefined, satnogsHz: number[]): number | null {
  if (satelliteHz != null) return satelliteHz;
  if (satnogsHz.length === 0) return null;
  return Math.min(...satnogsHz);
}

export function satelliteHasFrequencies(
  satelliteUplinkHz: number | null | undefined,
  satelliteDownlinkHz: number | null | undefined,
  enrichment: SatelliteEnrichment | null,
): boolean {
  if (satelliteUplinkHz != null || satelliteDownlinkHz != null) return true;
  if (!enrichment) return false;
  return enrichment.transmitters.some(
    (transmitter) => transmitter.uplinkHz !== null || transmitter.downlinkHz !== null,
  );
}

export function resolvePassFrequencyFields(
  satelliteUplinkHz: number | null | undefined,
  satelliteDownlinkHz: number | null | undefined,
  enrichment: SatelliteEnrichment | null,
): PassFrequencyFields {
  const satnogsUplinkHz = collectSatnogsUplinkHz(enrichment);
  const satnogsDownlinkHz = collectSatnogsDownlinkHz(enrichment);

  return {
    hasFrequencies: satelliteHasFrequencies(satelliteUplinkHz, satelliteDownlinkHz, enrichment),
    txDisplay: formatFrequencyColumn(satelliteUplinkHz, satnogsUplinkHz),
    rxDisplay: formatFrequencyColumn(satelliteDownlinkHz, satnogsDownlinkHz),
    txSortHz: firstSortHz(satelliteUplinkHz, satnogsUplinkHz),
    rxSortHz: firstSortHz(satelliteDownlinkHz, satnogsDownlinkHz),
  };
}

export function enrichPassRowsWithFrequencies(
  passes: SatellitePassBaseRow[],
  getEnrichmentForNoradId: (noradId: number) => SatelliteEnrichment | null,
): SatellitePassRow[] {
  return passes.map((pass) => ({
    ...pass,
    ...resolvePassFrequencyFields(
      pass.satelliteUplinkHz,
      pass.satelliteDownlinkHz,
      getEnrichmentForNoradId(pass.noradId),
    ),
  }));
}
