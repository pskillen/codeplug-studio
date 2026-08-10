import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { hzToMhzString } from '../../lib/units.ts';
import type { SatellitePassBaseRow, SatellitePassRow } from './useTrackingPasses.ts';

export interface PassFrequencyFields {
  hasFrequencies: boolean;
  /** Operator TX — satellite uplink centre frequency (or frequencies, one per transmitter). */
  txDisplay: string;
  /** Operator RX — satellite downlink centre frequency (or frequencies, one per transmitter). */
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

export function satelliteHasFrequencies(transmitters: SatelliteTransmitter[]): boolean {
  return transmitters.some((t) => !t.dismissed && (t.uplinkHz !== null || t.downlinkHz !== null));
}

export function resolvePassFrequencyFields(
  transmitters: SatelliteTransmitter[],
): PassFrequencyFields {
  const visible = transmitters.filter((t) => !t.dismissed);
  const uplinkHzValues = visible.map((t) => t.uplinkHz).filter((hz): hz is number => hz !== null);
  const downlinkHzValues = visible
    .map((t) => t.downlinkHz)
    .filter((hz): hz is number => hz !== null);
  const txLabels = uniqueMhzLabels(uplinkHzValues);
  const rxLabels = uniqueMhzLabels(downlinkHzValues);
  return {
    hasFrequencies: satelliteHasFrequencies(transmitters),
    txDisplay: txLabels.length > 0 ? txLabels.join(' · ') : '—',
    rxDisplay: rxLabels.length > 0 ? rxLabels.join(' · ') : '—',
    txSortHz: uplinkHzValues.length > 0 ? Math.min(...uplinkHzValues) : null,
    rxSortHz: downlinkHzValues.length > 0 ? Math.min(...downlinkHzValues) : null,
  };
}

export function enrichPassRowsWithFrequencies(passes: SatellitePassBaseRow[]): SatellitePassRow[] {
  return passes.map((pass) => ({
    ...pass,
    ...resolvePassFrequencyFields(pass.satelliteTransmitters),
  }));
}
