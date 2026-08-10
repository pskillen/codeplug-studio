import { describe, expect, it } from 'vitest';
import type { ParsedSatnogsEnrichmentEntry } from '@core/domain/satnogs/parseSatnogsTransmitters.ts';
import type { SatelliteEnrichment, SatelliteTransmitterInfo } from '@core/models/satelliteEnrichment.ts';
import { mergeSatelliteEnrichmentSet } from './mergeSatelliteEnrichment.ts';

function transmitter(overrides: Partial<SatelliteTransmitterInfo> = {}): SatelliteTransmitterInfo {
  return {
    uuid: 't1',
    description: 'FM voice',
    mode: 'FM',
    downlinkHz: 145800000,
    uplinkHz: 145200000,
    alive: true,
    status: 'active',
    ...overrides,
  };
}

function entry(overrides: Partial<ParsedSatnogsEnrichmentEntry> = {}): ParsedSatnogsEnrichmentEntry {
  return {
    noradId: 25544,
    transmitters: [transmitter()],
    ...overrides,
  };
}

function enrichment(overrides: Partial<SatelliteEnrichment> = {}): SatelliteEnrichment {
  return {
    noradId: 25544,
    source: 'satnogs',
    transmitters: [transmitter()],
    fetchedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('mergeSatelliteEnrichmentSet', () => {
  it('adds new enrichment rows not present in the existing set', () => {
    const result = mergeSatelliteEnrichmentSet([], [entry()]);
    expect(result).toMatchObject({ added: 1, updated: 0, unchanged: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ noradId: 25544, source: 'satnogs' });
  });

  it('leaves fetchedAt untouched when transmitters are unchanged, regardless of order', () => {
    const existing = enrichment({
      transmitters: [transmitter({ uuid: 't1' }), transmitter({ uuid: 't2' })],
    });
    const result = mergeSatelliteEnrichmentSet(
      [existing],
      [entry({ transmitters: [transmitter({ uuid: 't2' }), transmitter({ uuid: 't1' })] })],
    );

    expect(result).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    expect(result.rows[0].fetchedAt).toBe(existing.fetchedAt);
  });

  it('counts an updated row when transmitter data changed', () => {
    const existing = enrichment({ transmitters: [transmitter({ alive: false })] });
    const result = mergeSatelliteEnrichmentSet(
      [existing],
      [entry({ transmitters: [transmitter({ alive: true })] })],
    );

    expect(result).toMatchObject({ added: 0, updated: 1, unchanged: 0 });
    expect(result.rows[0].transmitters[0].alive).toBe(true);
    expect(result.rows[0].fetchedAt).not.toBe(existing.fetchedAt);
  });

  it('counts an updated row when transmitter count changed', () => {
    const existing = enrichment({ transmitters: [transmitter({ uuid: 't1' })] });
    const result = mergeSatelliteEnrichmentSet(
      [existing],
      [entry({ transmitters: [transmitter({ uuid: 't1' }), transmitter({ uuid: 't2' })] })],
    );

    expect(result).toMatchObject({ added: 0, updated: 1, unchanged: 0 });
  });

  it('keeps enrichment rows missing from a fresh fetch rather than deleting them', () => {
    const gone = enrichment({ noradId: 99999 });
    const result = mergeSatelliteEnrichmentSet([gone], [entry()]);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.some((row) => row.noradId === 99999)).toBe(true);
    expect(result.added).toBe(1);
  });
});
