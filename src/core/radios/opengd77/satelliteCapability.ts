/**
 * OpenGD77 satellite transmitter eligibility (DM-1701 / MD-9600) — write/preview boundary only.
 *
 * Radio UI slots are Freq 1 (FM voice), Freq 2 (APRS/packet), Freq 3 (beacon / CW / SSTV /
 * telemetry RX). Firmware does not track DMR satellite transponders. Standard RF is 136–174 /
 * 400–480 MHz; Studio does not model DM-1701 CPS Band Limits unlock. Not hardware-verified.
 *
 * Channel-eligibility `DM1701_BANDS` still uses 400–470 MHz — do not reuse that table here.
 */

import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';

export type OpenGd77SatelliteBankSlot = 'fm' | 'aprs' | 'beacon';

export const OPENGD77_SATELLITE_SLOT_LABELS: Record<OpenGd77SatelliteBankSlot, string> = {
  fm: 'FM slot',
  aprs: 'APRS slot',
  beacon: 'Beacon slot',
};

/** Satellite write RF gate — investigation standard range, not channel-list 400–470. */
const OPENGD77_SATELLITE_BANDS = [
  { minMhz: 136, maxMhz: 174 },
  { minMhz: 400, maxMhz: 480 },
] as const;

function normalizeMode(mode: string | null | undefined): string {
  return (mode ?? '').trim().toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
}

export function isFrequencyInOpenGd77SatelliteRange(hz: number | null | undefined): boolean {
  if (hz == null) return true;
  const mhz = hz / 1_000_000;
  return OPENGD77_SATELLITE_BANDS.some((band) => mhz >= band.minMhz && mhz <= band.maxMhz);
}

export function isOpenGd77SatelliteFrequencyEligible(transmitter: SatelliteTransmitter): boolean {
  return (
    isFrequencyInOpenGd77SatelliteRange(transmitter.uplinkHz) &&
    isFrequencyInOpenGd77SatelliteRange(transmitter.downlinkHz)
  );
}

/**
 * Which in-record slot this transmitter occupies, or null if OpenGD77 satellite mode cannot
 * use it (DMR, BPSK, GFSK, …). Empty mode → Freq 1 (FM).
 */
export function classifyOpenGd77SatelliteSlot(
  transmitter: Pick<SatelliteTransmitter, 'mode' | 'label'>,
): OpenGd77SatelliteBankSlot | null {
  const blob = `${normalizeMode(transmitter.mode)} ${transmitter.label.toUpperCase()}`;
  if (/\b(APRS|PACKET|AX\.?25|AFSK)\b/.test(blob)) return 'aprs';
  if (/\b(BEACON|CW|SSTV|TELEMETRY|TLM)\b/.test(blob)) return 'beacon';
  const mode = normalizeMode(transmitter.mode);
  if (!mode) return 'fm';
  if (
    mode === 'FM' ||
    mode === 'FMN' ||
    mode === 'NFM' ||
    mode === 'FM NARROW' ||
    mode === 'NARROW FM'
  ) {
    return 'fm';
  }
  return null;
}
