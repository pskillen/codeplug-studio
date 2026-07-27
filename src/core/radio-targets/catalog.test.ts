import { describe, expect, it } from 'vitest';
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import {
  defaultCompatibleEgress,
  hasMxNChannelExpansion,
  hasTalkGroupTimeslotClones,
  listRadioTargets,
  orderEgressPathsByCatalog,
  radioTargetFor,
  radioTargetHasCompatibleFormat,
  radioTargetIdForProfile,
  resolveBuildDefaultEgress,
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

  it('lists UV-21 with Web Serial and CHIRP egress', () => {
    const uv21 = radioTargetFor('baofeng-uv21');
    expect(uv21).toBeDefined();
    expect(uv21!.compatibleEgress.map((e) => e.profileId)).toEqual(['radio-io-uv21', 'chirp-uv21']);
  });

  it('lists RT95 VOX with Web Serial and CHIRP egress', () => {
    const rt95 = radioTargetFor('retevis-rt95');
    expect(rt95).toBeDefined();
    expect(rt95!.compatibleEgress.map((e) => e.profileId)).toEqual(['radio-io-rt95', 'chirp-rt95']);
  });

  it('maps legacy profile ids to a single Mini radio target', () => {
    expect(radioTargetIdForProfile('chirp-uv5r')).toBe('baofeng-uv5r-mini');
    expect(radioTargetIdForProfile('neonplug-uv5rmini')).toBe('baofeng-uv5r-mini');
    expect(radioTargetIdForProfile('radio-io-uv5r-mini')).toBe('baofeng-uv5r-mini');
    expect(radioTargetIdForProfile('radio-io-uv21')).toBe('baofeng-uv21');
    expect(radioTargetIdForProfile('chirp-uv21')).toBe('baofeng-uv21');
    expect(radioTargetIdForProfile('radio-io-rt95')).toBe('retevis-rt95');
    expect(radioTargetIdForProfile('chirp-rt95')).toBe('retevis-rt95');
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

  it('lists MD-9600 with Web Serial and OpenGD77 CSV egress', () => {
    const md9600 = radioTargetFor('tyt-md9600');
    expect(md9600).toBeDefined();
    expect(md9600!.compatibleEgress.map((e) => e.profileId)).toEqual([
      'radio-io-opengd77-md9600',
      'opengd77-md9600',
    ]);
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
      'radio-io-uv21',
      'radio-io-dm32uv',
      'radio-io-at-d890uv',
      'radio-io-opengd77-1701',
      'radio-io-opengd77-md9600',
      'radio-io-rt95',
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
    expect(radioTargetHasCompatibleFormat('anytone-at-d890uv', 'radio-io')).toBe(true);
  });

  it('gates Export projection traits by radio target for multi-egress Mini', () => {
    expect(showsDefaultScanInclusion('baofeng-uv5r-mini')).toBe(true);
    expect(showsPerChannelScanListNav('baofeng-uv5r-mini')).toBe(true);
    expect(hasMxNChannelExpansion('baofeng-uv5r-mini')).toBe(false);
    expect(hasMxNChannelExpansion('baofeng-dm32uv')).toBe(true);
    expect(hasMxNChannelExpansion('anytone-at-d890uv')).toBe(true);
    expect(hasTalkGroupTimeslotClones('baofeng-dm1701')).toBe(true);
    expect(hasTalkGroupTimeslotClones('tyt-md9600')).toBe(true);
    expect(hasTalkGroupTimeslotClones('baofeng-dm32uv')).toBe(false);
  });

  it('resolveBuildDefaultEgress prefers denormalised default pathway on the build', () => {
    const { build } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    expect(defaultCompatibleEgress(build.radioTargetId)?.profileId).toBe('radio-io-at-d890uv');
    expect(resolveBuildDefaultEgress(build)?.profileId).toBe('anytone-at-d890uv');
    expect(resolveBuildDefaultEgress(build)?.formatId).toBe('anytone');
  });
});
