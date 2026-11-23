/**
 * What RadioFoundry can store and track for a satellite (core/satellite/store.c at 454a5b76). Write boundary only:
 * the library never applies these. Tracking is FM only, one uplink/downlink pair per satellite.
 */
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { RADIOFOUNDRY_LIMITS, isInRadioFoundryBand, type RadioFoundryBand } from './limits.ts';

/** One frequency profile as the radio stores it. */
export interface RadioFoundrySatelliteProfile {
  catalogId: number;
  /** The satellite's downlink: what the radio receives. */
  rxHz: number;
  /** The satellite's uplink: what the radio transmits. */
  txHz: number;
  /** Uplink CTCSS in tenths of Hz; 0 for none. */
  toneTenths: number;
}

function normalizeMode(mode: string | null | undefined): string {
  return (mode ?? '').trim().toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
}

/** FM-family mode spellings; null or empty means FM. */
export function isRadioFoundrySatelliteFmMode(mode: string | null | undefined): boolean {
  const normalized = normalizeMode(mode);
  if (!normalized) return true;
  return (
    normalized === 'FM' ||
    normalized === 'FMN' ||
    normalized === 'NFM' ||
    normalized === 'FM NARROW' ||
    normalized === 'NARROW FM'
  );
}

const TLE_LINE_LEN = 69;
const VALID_CLASS = new Set(['U', 'C', 'S']);

function isPrintableTleLine(line: string): boolean {
  if (line.length !== TLE_LINE_LEN) return false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

/** Why this satellite's record cannot be written, as one sentence, or null. */
export function radioFoundrySatelliteProblem(
  satellite: Pick<Satellite, 'noradId' | 'tleLine1' | 'tleLine2'>,
): string | null {
  const max = RADIOFOUNDRY_LIMITS.SATELLITE_CATALOG_MAX;
  if (!Number.isInteger(satellite.noradId) || satellite.noradId < 1 || satellite.noradId > max) {
    return `RadioFoundry stores catalog numbers up to ${max} only.`;
  }
  if (!isPrintableTleLine(satellite.tleLine1) || !isPrintableTleLine(satellite.tleLine2)) {
    return 'Its TLE is not two 69-character lines.';
  }
  const classification = satellite.tleLine1[7];
  if (!classification || !VALID_CLASS.has(classification)) {
    return 'Its TLE classification is not U, C or S.';
  }
  return null;
}

/** Why this transmitter cannot be the satellite's profile, as one sentence, or null. */
export function radioFoundryTransmitterProblem(
  transmitter: Pick<SatelliteTransmitter, 'mode' | 'uplinkHz' | 'downlinkHz' | 'uplinkToneHz'>,
  bands: readonly RadioFoundryBand[],
): string | null {
  if (!isRadioFoundrySatelliteFmMode(transmitter.mode)) {
    return 'RadioFoundry tracks FM satellites only.';
  }
  if (transmitter.uplinkHz == null || transmitter.uplinkHz <= 0) {
    return 'RadioFoundry needs an uplink frequency to track a satellite.';
  }
  if (transmitter.downlinkHz == null || transmitter.downlinkHz <= 0) {
    return 'RadioFoundry needs a downlink frequency to track a satellite.';
  }
  const rxHz = Math.round(transmitter.downlinkHz);
  const txHz = Math.round(transmitter.uplinkHz);
  if (!isInRadioFoundryBand(rxHz, bands) || !isInRadioFoundryBand(txHz, bands)) {
    return "Its uplink or downlink is outside this radio's bands.";
  }
  const toneHz = transmitter.uplinkToneHz;
  if (toneHz != null && toneHz > 0) {
    const tenths = Math.round(toneHz * 10);
    if (
      tenths < RADIOFOUNDRY_LIMITS.SATELLITE_TONE_MIN_TENTHS ||
      tenths > RADIOFOUNDRY_LIMITS.SATELLITE_TONE_MAX_TENTHS
    ) {
      return 'Its uplink tone is outside 60.0–260.0 Hz.';
    }
  }
  return null;
}

/** The profile the radio would store for this pair. Throws when radioFoundryTransmitterProblem is not null. */
export function radioFoundrySatelliteProfile(
  catalogId: number,
  transmitter: Pick<SatelliteTransmitter, 'mode' | 'uplinkHz' | 'downlinkHz' | 'uplinkToneHz'>,
  bands: readonly RadioFoundryBand[],
): RadioFoundrySatelliteProfile {
  const problem = radioFoundryTransmitterProblem(transmitter, bands);
  if (problem) throw new Error(problem);
  const toneHz = transmitter.uplinkToneHz;
  return {
    catalogId,
    rxHz: Math.round(transmitter.downlinkHz!),
    txHz: Math.round(transmitter.uplinkHz!),
    toneTenths: toneHz != null && toneHz > 0 ? Math.round(toneHz * 10) : 0,
  };
}
