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
  it('lists the RT95 MM9PDY target with zones, Web Serial only; stock RT95 stays flat', () => {
    const mm = radioTargetFor('retevis-rt95-mm9pdy');
    expect(mm?.label).toBe('Retevis RT95 VOX (MM9PDY modded firmware)');
    expect(mm?.group).toBe('Retevis');
    expect(mm?.compatibleEgress.map((e) => e.profileId)).toEqual(['radio-io-rt95-mm9pdy']);
    expect(traitsForRadioTarget('retevis-rt95-mm9pdy')).toEqual([
      BuildCapabilityTrait.ZoneGrouping,
      BuildCapabilityTrait.ZoneAsScanList,
      BuildCapabilityTrait.PerChannelScanFlag,
    ]);
    expect(traitsForRadioTarget('retevis-rt95')).toContain(BuildCapabilityTrait.FlatMemoryList);
    expect(radioTargetIdForProfile('radio-io-rt95-mm9pdy')).toBe('retevis-rt95-mm9pdy');
  });

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
      'radio-io-dm32uv-mm9pdy',
      'radio-io-at-d890uv',
      'radio-io-at-d890uv-mm9pdy',
      'radio-io-opengd77-1701',
      'radio-io-opengd77-md9600',
      'radio-io-rt95',
      'radio-io-rt95-mm9pdy',
      'radiofoundry-dm32uv',
      'radio-io-dm32uv-radiofoundry',
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
    expect(hasMxNChannelExpansion('anytone-at-d890uv-mm9pdy')).toBe(false);
    expect(hasTalkGroupTimeslotClones('anytone-at-d890uv-mm9pdy')).toBe(false);
    expect(traitsForRadioTarget('anytone-at-d890uv-mm9pdy')).toEqual([
      BuildCapabilityTrait.ZoneGrouping,
      BuildCapabilityTrait.ZoneAsScanList,
      BuildCapabilityTrait.MultiTalkGroupPerChannel,
      BuildCapabilityTrait.SeparateDigitalIdList,
    ]);
    expect(radioTargetFor('anytone-at-d890uv-mm9pdy')?.label).toBe(
      'Anytone AT-D890UV (MM9PDY modded firmware)',
    );
    expect(
      radioTargetFor('anytone-at-d890uv-mm9pdy')?.compatibleEgress.map((e) => e.profileId),
    ).toEqual(['radio-io-at-d890uv-mm9pdy']);
    expect(radioTargetHasCompatibleFormat('anytone-at-d890uv-mm9pdy', 'anytone')).toBe(false);
    expect(hasMxNChannelExpansion('baofeng-dm32uv-mm9pdy')).toBe(false);
    expect(hasTalkGroupTimeslotClones('baofeng-dm32uv-mm9pdy')).toBe(false);
    expect(traitsForRadioTarget('baofeng-dm32uv-mm9pdy')).toEqual([
      BuildCapabilityTrait.ZoneGrouping,
      BuildCapabilityTrait.ZoneAsScanList,
      BuildCapabilityTrait.MultiTalkGroupPerChannel,
      BuildCapabilityTrait.SeparateDigitalIdList,
    ]);
    expect(radioTargetFor('baofeng-dm32uv-mm9pdy')?.label).toBe(
      'Baofeng DM-32UV (MM9PDY modded firmware)',
    );
    expect(
      radioTargetFor('baofeng-dm32uv-mm9pdy')?.compatibleEgress.map((e) => e.formatId),
    ).toEqual(['radio-io']);
    expect(hasMxNChannelExpansion('baofeng-dm32uv-radiofoundry')).toBe(false);
    expect(hasTalkGroupTimeslotClones('baofeng-dm32uv-radiofoundry')).toBe(false);
    expect(traitsForRadioTarget('baofeng-dm32uv-radiofoundry')).toEqual([
      BuildCapabilityTrait.ZoneGrouping,
      BuildCapabilityTrait.ZoneAsScanList,
      BuildCapabilityTrait.MultiTalkGroupPerChannel,
      BuildCapabilityTrait.SeparateDigitalIdList,
    ]);
    expect(radioTargetFor('baofeng-dm32uv-radiofoundry')?.label).toBe(
      'Baofeng DM-32UV (RadioFoundry)',
    );
    expect(radioTargetFor('baofeng-dm32uv-radiofoundry')?.group).toBe('Baofeng');
    expect(radioTargetFor('baofeng-dm32uv-radiofoundry')?.compatibleEgress).toEqual([
      {
        formatId: 'radiofoundry',
        profileId: 'radiofoundry-dm32uv',
        kind: 'cps-file',
        label: 'RadioFoundry codeplug',
      },
      {
        formatId: 'radio-io',
        profileId: 'radio-io-dm32uv-radiofoundry',
        kind: 'web-serial',
        label: 'Web Serial',
      },
    ]);
    expect(
      radioTargetFor('baofeng-dm32uv')?.compatibleEgress.some((e) => e.formatId === 'radiofoundry'),
    ).toBe(false);
    expect(
      radioTargetFor('baofeng-dm32uv-mm9pdy')?.compatibleEgress.some(
        (e) => e.formatId === 'radiofoundry',
      ),
    ).toBe(false);
    expect(traitsForRadioTarget('baofeng-dm32uv')).toEqual([
      BuildCapabilityTrait.ZoneGrouping,
      BuildCapabilityTrait.ScanLists,
      BuildCapabilityTrait.MxNChannelExpansion,
    ]);
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
