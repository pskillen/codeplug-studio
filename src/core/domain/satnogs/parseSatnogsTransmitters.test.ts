import { describe, expect, it } from 'vitest';
import type { SatnogsTransmitterRaw } from './satnogsTypes.ts';
import {
  groupSatnogsTransmittersByNoradId,
  mapSatnogsTransmitter,
} from './parseSatnogsTransmitters.ts';

function raw(overrides: Partial<SatnogsTransmitterRaw> = {}): SatnogsTransmitterRaw {
  return {
    uuid: 'abc-123',
    description: 'FM voice repeater',
    mode: 'FM',
    downlink_low: 145800000,
    uplink_low: 145200000,
    alive: true,
    status: 'active',
    norad_cat_id: 25544,
    ...overrides,
  };
}

describe('mapSatnogsTransmitter', () => {
  it('maps upstream field names onto the vendor-neutral shape', () => {
    expect(mapSatnogsTransmitter(raw())).toEqual({
      uuid: 'abc-123',
      description: 'FM voice repeater',
      mode: 'FM',
      downlinkHz: 145800000,
      uplinkHz: 145200000,
      alive: true,
      status: 'active',
    });
  });

  it('defaults a null description to an empty string and passes through null frequencies', () => {
    const mapped = mapSatnogsTransmitter(
      raw({ description: null, downlink_low: null, uplink_low: null }),
    );
    expect(mapped.description).toBe('');
    expect(mapped.downlinkHz).toBeNull();
    expect(mapped.uplinkHz).toBeNull();
  });
});

describe('groupSatnogsTransmittersByNoradId', () => {
  it('groups multiple transmitters for the same satellite together', () => {
    const grouped = groupSatnogsTransmittersByNoradId([raw({ uuid: 't1' }), raw({ uuid: 't2' })]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ noradId: 25544 });
    expect(grouped[0].transmitters).toHaveLength(2);
  });

  it('splits transmitters across satellites by norad_cat_id', () => {
    const grouped = groupSatnogsTransmittersByNoradId([
      raw({ uuid: 't1', norad_cat_id: 25544 }),
      raw({ uuid: 't2', norad_cat_id: 43017 }),
    ]);
    expect(grouped.map((g) => g.noradId).sort()).toEqual([25544, 43017]);
  });

  it('returns an empty array for an empty input', () => {
    expect(groupSatnogsTransmittersByNoradId([])).toEqual([]);
  });
});
