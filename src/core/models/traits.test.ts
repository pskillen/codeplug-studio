import { describe, expect, it } from 'vitest';
import {
  BuildCapabilityTrait,
  TRAIT_PROFILES,
  hasDedicatedScanLists,
  showsDefaultScanInclusion,
  traitProfileFor,
} from './traits.ts';
import { STUDIO_SCHEMA_VERSION } from './schemaVersion.ts';
import { newFormatBuild, newProjectMeta } from '../domain/factories.ts';
import { nextRevision, initialRevision } from './revision.ts';

describe('schemaVersion', () => {
  it('starts at 4', () => {
    expect(STUDIO_SCHEMA_VERSION).toBe(17);
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

  it('distinguishes dedicated vs zone-derived scan list semantics', () => {
    expect(hasDedicatedScanLists('anytone-at-d890uv')).toBe(true);
    expect(hasDedicatedScanLists('dm32-baofeng-dm32uv')).toBe(false);
    expect(showsDefaultScanInclusion('anytone-at-d890uv')).toBe(false);
    expect(showsDefaultScanInclusion('dm32-baofeng-dm32uv')).toBe(true);
    expect(showsDefaultScanInclusion('opengd77-1701')).toBe(true);
    expect(showsDefaultScanInclusion('chirp-uv5r')).toBe(true);
  });

  it('has stable profile keys', () => {
    expect(Object.keys(TRAIT_PROFILES).sort()).toEqual([
      'anytone-at-d890uv',
      'chirp-rt95',
      'chirp-uv21',
      'chirp-uv5r',
      'dm32-baofeng-dm32uv',
      'opengd77-1701',
      'opengd77-md9600',
    ]);
  });
});

describe('factories', () => {
  it('creates project metadata with revision 1', () => {
    const project = newProjectMeta('Test');
    expect(project.name).toBe('Test');
    expect(project.revision).toBe(initialRevision());
    expect(project.id).toBe(project.projectId);
  });

  it('creates format build from profile', () => {
    const projectId = newProjectMeta('P').id;
    const build = newFormatBuild(projectId, 'opengd77-1701');
    expect(build.formatId).toBe('opengd77');
    expect(build.profileId).toBe('opengd77-1701');
    expect(build.layout.sections).toEqual([]);
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
