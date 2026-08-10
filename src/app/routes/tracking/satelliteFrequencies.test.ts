import { describe, expect, it } from 'vitest';
import type { SatelliteEnrichment } from '@core/models/satelliteEnrichment.ts';
import { resolvePassFrequencyFields, satelliteHasFrequencies } from './satelliteFrequencies.ts';

function enrichment(transmitters: SatelliteEnrichment['transmitters']): SatelliteEnrichment {
  return {
    noradId: 25544,
    source: 'satnogs',
    fetchedAt: '2026-08-10T12:00:00.000Z',
    transmitters,
  };
}

describe('satelliteHasFrequencies', () => {
  it('is true when library uplink or downlink is set', () => {
    expect(satelliteHasFrequencies(145_990_000, null, null)).toBe(true);
    expect(satelliteHasFrequencies(null, 437_800_000, null)).toBe(true);
  });

  it('is true when SatNOGS transmitters carry frequencies', () => {
    expect(
      satelliteHasFrequencies(
        null,
        null,
        enrichment([
          {
            uuid: 'a',
            description: 'FM',
            mode: 'FM',
            uplinkHz: null,
            downlinkHz: 145_800_000,
            alive: true,
            status: 'active',
          },
        ]),
      ),
    ).toBe(true);
  });

  it('is false when neither source has frequencies', () => {
    expect(satelliteHasFrequencies(null, null, null)).toBe(false);
    expect(
      satelliteHasFrequencies(
        null,
        null,
        enrichment([
          {
            uuid: 'a',
            description: 'CW',
            mode: 'CW',
            uplinkHz: null,
            downlinkHz: null,
            alive: false,
            status: 'inactive',
          },
        ]),
      ),
    ).toBe(false);
  });
});

describe('resolvePassFrequencyFields', () => {
  it('shows library and SatNOGS MHz values in the same column', () => {
    const fields = resolvePassFrequencyFields(
      145_990_000,
      437_800_000,
      enrichment([
        {
          uuid: 'a',
          description: 'FM',
          mode: 'FM',
          uplinkHz: 145_200_000,
          downlinkHz: 145_800_000,
          alive: true,
          status: 'active',
        },
      ]),
    );

    expect(fields.hasFrequencies).toBe(true);
    expect(fields.txDisplay).toBe('145.99 MHz · 145.2 MHz');
    expect(fields.rxDisplay).toBe('437.8 MHz · 145.8 MHz');
    expect(fields.txSortHz).toBe(145_990_000);
    expect(fields.rxSortHz).toBe(437_800_000);
  });

  it('uses SatNOGS-only values when library fields are unset', () => {
    const fields = resolvePassFrequencyFields(
      null,
      null,
      enrichment([
        {
          uuid: 'a',
          description: 'FM',
          mode: 'FM',
          uplinkHz: 145_200_000,
          downlinkHz: 145_800_000,
          alive: true,
          status: 'active',
        },
      ]),
    );

    expect(fields.txDisplay).toBe('145.2 MHz');
    expect(fields.rxDisplay).toBe('145.8 MHz');
  });
});
