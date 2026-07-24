import { describe, expect, it } from 'vitest';
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import {
  defaultCompatibleEgress,
  hasMxNChannelExpansion,
  listRadioTargets,
  orderEgressPathsByCatalog,
  radioTargetFor,
  radioTargetHasCompatibleFormat,
  radioTargetIdForProfile,
  showsDefaultScanInclusion,
  showsPerChannelScanListNav,
  traitsForRadioTarget,
} from './catalog.ts';

describe('radio target catalog', () => {
  it('lists UV-5R Mini with Web Serial, NeonPlug, and CHIRP egress', () => {
    const mini = radioTargetFor('baofeng-uv5r-mini');
    expect(mini).toBeDefined();
    expect(mini!.compatibleEgress.map((e) => e.profileId)).toEqual([
      'radio-io-uv5r-mini',
      'neonplug-uv5rmini',
      'chirp-uv5r',
    ]);
    expect(mini!.compatibleEgress.map((e) => e.kind)).toEqual([
      'web-serial',
      'cps-file',
      'cps-file',
    ]);
  });

  it('maps legacy profile ids to a single Mini radio target', () => {
    expect(radioTargetIdForProfile('chirp-uv5r')).toBe('baofeng-uv5r-mini');
    expect(radioTargetIdForProfile('neonplug-uv5rmini')).toBe('baofeng-uv5r-mini');
    expect(radioTargetIdForProfile('radio-io-uv5r-mini')).toBe('baofeng-uv5r-mini');
  });

  it('exposes flat-memory traits for Mini', () => {
    const traits = traitsForRadioTarget('baofeng-uv5r-mini');
    expect(traits).toContain(BuildCapabilityTrait.FlatMemoryList);
    expect(traits).toContain(BuildCapabilityTrait.PerChannelScanFlag);
  });

  it('defaults Mini egress to Web Serial first', () => {
    expect(defaultCompatibleEgress('baofeng-uv5r-mini')?.formatId).toBe('radio-io');
  });

  it('orders shuffled Mini egress paths with Web Serial first', () => {
    const ordered = orderEgressPathsByCatalog('baofeng-uv5r-mini', [
      { formatId: 'chirp', profileId: 'chirp-uv5r' },
      { formatId: 'neonplug', profileId: 'neonplug-uv5rmini' },
      { formatId: 'radio-io', profileId: 'radio-io-uv5r-mini' },
    ]);
    expect(ordered.map((p) => p.formatId)).toEqual(['radio-io', 'neonplug', 'chirp']);
  });

  it('covers every shipped TRAIT_PROFILES radio via catalog egress', () => {
    const ids = listRadioTargets().flatMap((t) => t.compatibleEgress.map((e) => e.profileId));
    for (const profileId of [
      'opengd77-1701',
      'opengd77-md9600',
      'dm32-baofeng-dm32uv',
      'chirp-uv5r',
      'chirp-rt95',
      'chirp-uv21',
      'anytone-at-d890uv',
      'neonplug-dm32uv',
      'neonplug-uv5rmini',
      'radio-io-uv5r-mini',
      'radio-io-dm32uv',
      'radio-io-opengd77-1701',
    ]) {
      expect(ids).toContain(profileId);
    }
  });

  it('reports compatible formats independently of active egress', () => {
    expect(radioTargetHasCompatibleFormat('baofeng-uv5r-mini', 'chirp')).toBe(true);
    expect(radioTargetHasCompatibleFormat('baofeng-uv5r-mini', 'neonplug')).toBe(true);
    expect(radioTargetHasCompatibleFormat('baofeng-uv5r-mini', 'radio-io')).toBe(true);
    expect(radioTargetHasCompatibleFormat('baofeng-uv5r-mini', 'anytone')).toBe(false);
    expect(radioTargetHasCompatibleFormat('baofeng-dm32uv', 'dm32')).toBe(true);
    expect(radioTargetHasCompatibleFormat('baofeng-dm32uv', 'radio-io')).toBe(true);
    expect(radioTargetHasCompatibleFormat('anytone-at-d890uv', 'anytone')).toBe(true);
  });

  it('gates Export projection traits by radio target for multi-egress Mini', () => {
    expect(showsDefaultScanInclusion('baofeng-uv5r-mini')).toBe(true);
    expect(showsPerChannelScanListNav('baofeng-uv5r-mini')).toBe(true);
    expect(hasMxNChannelExpansion('baofeng-uv5r-mini')).toBe(false);
    expect(hasMxNChannelExpansion('baofeng-dm32uv')).toBe(true);
    expect(hasMxNChannelExpansion('anytone-at-d890uv')).toBe(true);
  });
});
