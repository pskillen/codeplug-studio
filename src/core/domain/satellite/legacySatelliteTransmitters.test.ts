import { describe, expect, it } from 'vitest';
import { synthesizeLegacySatelliteTransmitters } from './legacySatelliteTransmitters.ts';

describe('synthesizeLegacySatelliteTransmitters', () => {
  it('returns an empty array when all legacy scalar fields are unset', () => {
    const result = synthesizeLegacySatelliteTransmitters({
      uplinkHz: null,
      downlinkHz: null,
      uplinkToneHz: null,
      downlinkToneHz: null,
    });

    expect(result).toEqual([]);
  });

  it('synthesizes one manual, write-eligible transmitter from legacy scalar fields', () => {
    const result = synthesizeLegacySatelliteTransmitters({
      uplinkHz: 145_990_000,
      downlinkHz: 437_800_000,
      uplinkToneHz: 67,
      downlinkToneHz: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      uplinkHz: 145_990_000,
      downlinkHz: 437_800_000,
      uplinkToneHz: 67,
      downlinkToneHz: null,
      source: 'manual',
      dismissed: false,
      includeInWrite: true,
    });
  });
});
