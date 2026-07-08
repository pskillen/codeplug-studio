import { describe, expect, it } from 'vitest';
import {
  generateChannelsFromAirport,
  type AirbandAirportInput,
} from './generate.ts';

const glasgowAirport: AirbandAirportInput = {
  name: 'Glasgow',
  icao: 'EGPF',
  iata: 'GLA',
  location: { lat: 55.8719, lon: -4.433 },
  frequencies: [
    { service: 'Tower', rxFrequencyHz: 118_805_000 },
    { service: 'ATIS', rxFrequencyHz: 129_575_000 },
    { service: 'Out of band', rxFrequencyHz: 145_500_000 },
  ],
};

describe('generateChannelsFromAirport', () => {
  it('creates RX-only AM channels with airband naming', () => {
    const channels = generateChannelsFromAirport('p1', glasgowAirport);
    expect(channels).toHaveLength(2);
    expect(channels[0]).toMatchObject({
      name: 'GLA Tower',
      rxFrequency: 118_805_000,
      txFrequency: null,
      forbidTransmit: true,
      power: null,
    });
    expect(channels[0]?.modeProfiles[0]?.mode).toBe('am');
    expect(channels[0]?.location).toMatchObject({ lat: 55.8719, lon: -4.433 });
  });

  it('applies name prefix', () => {
    const channels = generateChannelsFromAirport('p1', glasgowAirport, {
      namePrefix: 'AB-',
      frequencyIndices: [0],
    });
    expect(channels[0]?.name).toBe('AB-GLA Tower');
  });
});
