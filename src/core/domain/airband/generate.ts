import { bandFromFrequencyMhz } from '../bandCatalog.ts';
import { newChannel } from '../factories.ts';
import { defaultModeProfile } from '../modeProfiles.ts';
import type { Channel } from '../../models/library.ts';
import type { ChannelModeProfileAnalog } from '../../models/library.ts';
import type { AirbandAirportInput, AirbandGenerateOptions } from './types.ts';

const AIRBAND_BAND_ID = 'airband';

function amAirbandProfile(bandwidthKHz: number): ChannelModeProfileAnalog {
  const base = defaultModeProfile('am') as ChannelModeProfileAnalog;
  return { ...base, bandwidthKHz };
}

function applyNamePrefix(name: string, prefix: string | undefined): string {
  const trimmed = prefix?.trim() ?? '';
  if (!trimmed) return name;
  return `${trimmed}${name}`;
}

function airportCodeLabel(airport: AirbandAirportInput): string {
  return airport.iata ?? airport.icao ?? airport.name;
}

function channelNameForFrequency(
  airport: AirbandAirportInput,
  service: string,
  options: AirbandGenerateOptions,
): string {
  const code = airportCodeLabel(airport);
  const base = `${code} ${service}`.trim();
  return applyNamePrefix(base, options.namePrefix);
}

function isCivilAirbandHz(rxFrequencyHz: number): boolean {
  const mhz = rxFrequencyHz / 1_000_000;
  const band = bandFromFrequencyMhz(mhz);
  return band?.id === AIRBAND_BAND_ID;
}

/**
 * Generate RX-only AM airband library channels from airport frequency inputs.
 */
export function generateChannelsFromAirport(
  projectId: string,
  airport: AirbandAirportInput,
  options: AirbandGenerateOptions = {},
): Channel[] {
  const forbidTransmit = options.forbidTransmit ?? true;
  const power = options.power !== undefined ? options.power : null;
  const bandwidthKHz = options.bandwidthKHz ?? 12.5;
  const modeProfiles = [amAirbandProfile(bandwidthKHz)];

  const frequencies = options.frequencyIndices
    ? airport.frequencies.filter((_, index) => options.frequencyIndices!.includes(index))
    : airport.frequencies;

  const channels: Channel[] = [];

  for (const freq of frequencies) {
    if (!isCivilAirbandHz(freq.rxFrequencyHz)) continue;

    const name = channelNameForFrequency(airport, freq.service, options);
    const base = newChannel(projectId, name);
    channels.push({
      ...base,
      rxFrequency: freq.rxFrequencyHz,
      txFrequency: null,
      power,
      forbidTransmit,
      modeProfiles,
      ...(airport.location
        ? {
            location: { lat: airport.location.lat, lon: airport.location.lon },
            useLocation: true,
          }
        : {}),
    });
  }

  return channels;
}

export function generateChannelsFromAirports(
  projectId: string,
  airports: AirbandAirportInput[],
  options: AirbandGenerateOptions = {},
): Channel[] {
  return airports.flatMap((airport) => generateChannelsFromAirport(projectId, airport, options));
}
