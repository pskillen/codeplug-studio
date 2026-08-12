import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import {
  encodeSatelliteTransmitterWireName,
  trimEncodedWireName,
} from './encodeSatelliteTransmitterWireName.ts';
import { shortenSatelliteNames } from './shortenSatelliteNames.ts';

export interface SatelliteTransmitterPair {
  satellite: Satellite;
  transmitter: SatelliteTransmitter;
}

export interface SatelliteTransmitterWriteNameResult {
  satelliteId: string;
  transmitterId: string;
  /** Effective ≤maxLength name written to the radio (override or generated). */
  encodedName: string;
  /** Familiar-path encoded suggestion (ignoring overrides). */
  generatedEncodedName: string;
  /** Familiar short name before label combine. */
  satelliteShortName: string;
  suggestedFamiliarShort: string;
  suggestedOscarShort: string | null;
  suggestedFamiliarEncoded: string;
  suggestedOscarEncoded: string | null;
  fromOverride: boolean;
}

export interface ResolveSatelliteTransmitterWriteNamesOptions {
  maxLength: number;
}

function disambiguateEncoded(
  encoded: string,
  taken: Set<string>,
  maxLength: number,
  seed: string,
): string {
  if (!taken.has(encoded.trimEnd())) return encoded;
  for (let i = 2; i < 100; i++) {
    const suffix = `~${i}`;
    const base = encoded.trimEnd().slice(0, maxLength - suffix.length);
    const candidate = `${base}${suffix}`.slice(0, maxLength);
    if (!taken.has(candidate.trimEnd())) return candidate;
  }
  const fallback = seed.slice(0, maxLength);
  return taken.has(fallback.trimEnd()) ? `${fallback.slice(0, maxLength - 1)}~` : fallback;
}

function normalizeOverride(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

/**
 * Resolve per-transmitter encoded wire names for a write set. Overrides are keyed by
 * transmitter id and store the full encoded field. Generated names stay unique among
 * non-overridden rows; overrides may duplicate (collision warnings are UI-only).
 */
export function resolveSatelliteTransmitterWriteNames(
  pairs: readonly SatelliteTransmitterPair[],
  satelliteOverrides: readonly BuildEntityOverride[] | undefined,
  options: ResolveSatelliteTransmitterWriteNamesOptions,
): Map<string, SatelliteTransmitterWriteNameResult> {
  const { maxLength } = options;
  const overrides = overrideByEntityId(satelliteOverrides);

  const satelliteById = new Map<string, Satellite>();
  for (const { satellite } of pairs) {
    satelliteById.set(satellite.id, satellite);
  }

  const satelliteInputs = [...satelliteById.values()].map((satellite) => ({
    id: satellite.id,
    name: satellite.name,
    noradId: satellite.noradId,
  }));

  const satelliteNames = shortenSatelliteNames(satelliteInputs, { maxLength });

  const sortedPairs = [...pairs].sort((a, b) => {
    const norad = a.satellite.noradId - b.satellite.noradId;
    if (norad !== 0) return norad;
    return a.transmitter.id.localeCompare(b.transmitter.id);
  });

  const generatedTaken = new Set<string>();
  const results = new Map<string, SatelliteTransmitterWriteNameResult>();

  for (const { satellite, transmitter } of sortedPairs) {
    const satResolved = satelliteNames.get(satellite.id)!;
    const familiarShort = satResolved.suggestedFamiliar;
    const oscarShort = satResolved.suggestedOscar;

    const familiarEncoded = trimEncodedWireName(
      encodeSatelliteTransmitterWireName(familiarShort, transmitter.label, maxLength),
    );
    const oscarEncoded =
      oscarShort != null
        ? trimEncodedWireName(
            encodeSatelliteTransmitterWireName(oscarShort, transmitter.label, maxLength),
          )
        : null;

    const defaultEncoded = trimEncodedWireName(
      encodeSatelliteTransmitterWireName(
        satResolved.generatedShortName,
        transmitter.label,
        maxLength,
      ),
    );

    const override = overrides.get(transmitter.id)?.wireName?.trim();
    if (override) {
      const encodedName = normalizeOverride(override, maxLength);
      results.set(transmitter.id, {
        satelliteId: satellite.id,
        transmitterId: transmitter.id,
        encodedName,
        generatedEncodedName: defaultEncoded,
        satelliteShortName: satResolved.generatedShortName,
        suggestedFamiliarShort: familiarShort,
        suggestedOscarShort: oscarShort,
        suggestedFamiliarEncoded: familiarEncoded,
        suggestedOscarEncoded: oscarEncoded,
        fromOverride: true,
      });
      continue;
    }

    let encodedName = defaultEncoded;
    encodedName = trimEncodedWireName(
      disambiguateEncoded(encodedName, generatedTaken, maxLength, transmitter.id),
    );
    generatedTaken.add(encodedName);

    results.set(transmitter.id, {
      satelliteId: satellite.id,
      transmitterId: transmitter.id,
      encodedName,
      generatedEncodedName: defaultEncoded,
      satelliteShortName: satResolved.generatedShortName,
      suggestedFamiliarShort: familiarShort,
      suggestedOscarShort: oscarShort,
      suggestedFamiliarEncoded: familiarEncoded,
      suggestedOscarEncoded: oscarEncoded,
      fromOverride: false,
    });
  }

  return results;
}
