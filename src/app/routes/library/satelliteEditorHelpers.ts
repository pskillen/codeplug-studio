import type { SatelliteTransmitterInfo } from '@core/models/satelliteEnrichment.ts';

export function transmitterLabel(transmitter: SatelliteTransmitterInfo): string {
  const modeLabel = transmitter.mode ?? 'unknown mode';
  const suffix = transmitter.alive ? '' : ' (inactive)';
  return `${transmitter.description} — ${modeLabel}${suffix}`;
}

/** Alive transmitters first, both groups otherwise in upstream order. */
export function sortTransmittersAliveFirst(
  transmitters: SatelliteTransmitterInfo[],
): SatelliteTransmitterInfo[] {
  return [...transmitters].sort((a, b) => Number(b.alive) - Number(a.alive));
}

export const FREQUENCY_FIELD_ERROR = 'Enter a positive frequency in MHz.';
export const TONE_FIELD_ERROR = 'Enter a positive tone in Hz.';

/**
 * Non-blocking inline validation: only surfaces once the operator has typed something that
 * fails to parse (covers both non-numeric entry and the out-of-range rejection in units.ts).
 */
export function fieldError(
  rawValue: string,
  parsed: number | null,
  message: string,
): string | undefined {
  return rawValue.trim() !== '' && parsed === null ? message : undefined;
}
