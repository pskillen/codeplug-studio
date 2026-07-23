import { describe, expect, it } from 'vitest';
import { BuildCapabilityTrait, TRAIT_PROFILES, traitProfileFor } from './traits.ts';
import { STUDIO_SCHEMA_VERSION } from './schemaVersion.ts';
import { newFormatBuild, newProjectMeta, newRadioBuildForProfile } from '../domain/factories.ts';
import {
  hasDedicatedScanLists,
  radioTargetIdForProfile,
  showsDefaultScanInclusion,
  showsPerChannelScanListNav,
} from '../radio-targets/catalog.ts';
import { nextRevision, initialRevision } from './revision.ts';

describe('schemaVersion', () => {
  it('starts at 4', () => {
    expect(STUDIO_SCHEMA_VERSION).toBe(22);
  });
});

describe('trait profiles', () => {
  it('registers opengd77-1701 with zone traits', () => {
    const profile = traitProfileFor('opengd77-1701');
    expect(profile?.traits).toContain(BuildCapabilityTrait.ZoneGrouping);
    expect(profile?.traits).toContain(BuildCapabilityTrait.MultiTalkGroupPerChannel);
  });

  it('registers chirp-uv5r with flat memory traits', () => {
    const profile = traitProfileFor('chirp-uv5r');
    expect(profile?.traits).toContain(BuildCapabilityTrait.FlatMemoryList);
    expect(profile?.traits).toContain(BuildCapabilityTrait.PerChannelScanFlag);
  });

  it('registers all CHIRP variants with per-channel scan flag', () => {
    for (const profileId of ['chirp-uv5r', 'chirp-rt95', 'chirp-uv21'] as const) {
      const profile = traitProfileFor(profileId);
      expect(profile?.formatId).toBe('chirp');
      expect(profile?.traits).toContain(BuildCapabilityTrait.FlatMemoryList);
      expect(profile?.traits).toContain(BuildCapabilityTrait.PerChannelScanFlag);
    }
  });

  it('registers opengd77-md9600 with zone traits', () => {
    const profile = traitProfileFor('opengd77-md9600');
    expect(profile?.traits).toContain(BuildCapabilityTrait.ZoneGrouping);
    expect(profile?.traits).toContain(BuildCapabilityTrait.ZoneAsScanList);
  });

  it('registers anytone-at-d890uv with zone grouping and dedicated scan lists', () => {
    const profile = traitProfileFor('anytone-at-d890uv');
    expect(profile?.traits).toContain(BuildCapabilityTrait.ZoneGrouping);
    expect(profile?.traits).toContain(BuildCapabilityTrait.DedicatedScanLists);
    expect(profile?.traits).not.toContain(BuildCapabilityTrait.ScanLists);
  });

  it('registers dm32 with zone-derived scan lists trait', () => {
    const profile = traitProfileFor('dm32-baofeng-dm32uv');
    expect(profile?.traits).toContain(BuildCapabilityTrait.ScanLists);
    expect(profile?.traits).not.toContain(BuildCapabilityTrait.DedicatedScanLists);
  });

  it('registers neonplug-dm32uv with zone grouping, scan lists, and m×n expansion', () => {
    const profile = traitProfileFor('neonplug-dm32uv');
    expect(profile?.formatId).toBe('neonplug');
    expect(profile?.traits).toContain(BuildCapabilityTrait.ZoneGrouping);
    expect(profile?.traits).toContain(BuildCapabilityTrait.ScanLists);
    expect(profile?.traits).toContain(BuildCapabilityTrait.MxNChannelExpansion);
    expect(profile?.traits).not.toContain(BuildCapabilityTrait.DedicatedScanLists);
  });

  it('registers neonplug-uv5rmini with flat memory traits', () => {
    const profile = traitProfileFor('neonplug-uv5rmini');
    expect(profile?.formatId).toBe('neonplug');
    expect(profile?.traits).toContain(BuildCapabilityTrait.FlatMemoryList);
    expect(profile?.traits).toContain(BuildCapabilityTrait.PerChannelScanFlag);
  });

  it('registers radio-io-uv5r-mini with flat memory traits (Web Serial only)', () => {
    const profile = traitProfileFor('radio-io-uv5r-mini');
    expect(profile?.formatId).toBe('radio-io');
    expect(profile?.traits).toContain(BuildCapabilityTrait.FlatMemoryList);
    expect(profile?.traits).toContain(BuildCapabilityTrait.PerChannelScanFlag);
  });

  it('has stable profile keys', () => {
    expect(Object.keys(TRAIT_PROFILES).sort()).toEqual([
      'anytone-at-d890uv',
      'chirp-rt95',
      'chirp-uv21',
      'chirp-uv5r',
      'dm32-baofeng-dm32uv',
      'neonplug-dm32uv',
      'neonplug-uv5rmini',
      'opengd77-1701',
      'opengd77-md9600',
      'radio-io-uv5r-mini',
    ]);
  });
});

describe('radio-target trait gates', () => {
  it('distinguishes dedicated vs zone-derived scan list semantics by radio target', () => {
    expect(hasDedicatedScanLists('anytone-at-d890uv')).toBe(true);
    expect(hasDedicatedScanLists('baofeng-dm32uv')).toBe(false);
    expect(hasDedicatedScanLists('baofeng-dm1701')).toBe(false);
    expect(showsDefaultScanInclusion('anytone-at-d890uv')).toBe(false);
    expect(showsDefaultScanInclusion('baofeng-dm32uv')).toBe(true);
    expect(showsDefaultScanInclusion('baofeng-dm1701')).toBe(true);
    expect(showsDefaultScanInclusion('baofeng-uv5r-mini')).toBe(true);
  });

  it('keeps UV-5R Mini scan/m×n visibility identical across egress profiles', () => {
    const radioTargetId = 'baofeng-uv5r-mini';
    expect(showsDefaultScanInclusion(radioTargetId)).toBe(true);
    expect(showsPerChannelScanListNav(radioTargetId)).toBe(true);
    expect(hasDedicatedScanLists(radioTargetId)).toBe(false);
    for (const profileId of ['radio-io-uv5r-mini', 'neonplug-uv5rmini', 'chirp-uv5r'] as const) {
      expect(radioTargetIdForProfile(profileId)).toBe(radioTargetId);
    }
  });
});

describe('factories', () => {
  it('creates project metadata with revision 1', () => {
    const project = newProjectMeta('Test');
    expect(project.name).toBe('Test');
    expect(project.revision).toBe(initialRevision());
    expect(project.id).toBe(project.projectId);
  });

  it('creates radio build from profile with egress', () => {
    const projectId = newProjectMeta('P').id;
    const { build, egress } = newRadioBuildForProfile(projectId, 'opengd77-1701');
    expect(build.radioTargetId).toBe(radioTargetIdForProfile('opengd77-1701'));
    expect(egress.formatId).toBe('opengd77');
    expect(egress.profileId).toBe('opengd77-1701');
    expect(build.layout.sections).toEqual([]);
  });

  it('creates NeonPlug radio builds from trait profiles', () => {
    const projectId = newProjectMeta('P').id;
    const dm32uv = newRadioBuildForProfile(projectId, 'neonplug-dm32uv');
    expect(dm32uv.build.radioTargetId).toBe('baofeng-dm32uv');
    expect(dm32uv.egress.formatId).toBe('neonplug');
    expect(dm32uv.egress.profileId).toBe('neonplug-dm32uv');
    const uv5r = newRadioBuildForProfile(projectId, 'neonplug-uv5rmini');
    expect(uv5r.build.radioTargetId).toBe('baofeng-uv5r-mini');
    expect(uv5r.egress.formatId).toBe('neonplug');
    expect(uv5r.egress.profileId).toBe('neonplug-uv5rmini');
  });

  it('creates Direct radio build for UV-5R Mini Web Serial', () => {
    const projectId = newProjectMeta('P').id;
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-uv5r-mini');
    expect(build.radioTargetId).toBe('baofeng-uv5r-mini');
    expect(egress.formatId).toBe('radio-io');
    expect(egress.profileId).toBe('radio-io-uv5r-mini');
  });

  it('rejects unknown profile', () => {
    expect(() => newFormatBuild('p1', 'unknown-profile')).toThrow(/Unknown trait profile/);
  });
});

describe('revision', () => {
  it('increments revision', () => {
    expect(nextRevision(1)).toBe(2);
  });
});
