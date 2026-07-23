import { describe, expect, it } from 'vitest';
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import {
  defaultCompatibleEgress,
  listRadioTargets,
  radioTargetFor,
  radioTargetIdForProfile,
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
    ]) {
      expect(ids).toContain(profileId);
    }
  });
});
