import { describe, expect, it } from 'vitest';
import {
  emptyLibrary,
  newRadioBuildForProfile,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { upsertOverride } from '@core/domain/formatBuildOverrides.ts';
import { librarySliceFrom, type LibrarySlice } from '@core/services/assemble.ts';
import type { Library } from '@core/models/library.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { classifyWireNameRemediation, resolveWireNames } from './resolveWireNames.ts';

const PROJECT_ID = 'proj-1';

/** DM-32: channel/zone/contact/talk-group name limit 16; scan list / RX group list 10. */
const DM32_FORMAT_ID = 'dm32';
const DM32_PROFILE_ID = 'dm32-baofeng-dm32uv';

function dm32Fixture(): { build: RadioBuild; library: LibrarySlice; lib: Library } {
  const lib: Library = emptyLibrary();
  const { build } = newRadioBuildForProfile(PROJECT_ID, DM32_PROFILE_ID);
  return { build, library: librarySliceFrom(lib), lib };
}

describe('resolveWireNames', () => {
  it('remediation "none" — name already fits, no collision', () => {
    const { lib, build } = dm32Fixture();
    lib.zones.push({ ...newZone(PROJECT_ID, 'Home'), projectId: PROJECT_ID });
    const rows = resolveWireNames({
      build,
      library: librarySliceFrom(lib),
      entityKind: 'zone',
      formatId: DM32_FORMAT_ID,
      profileId: DM32_PROFILE_ID,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      libraryName: 'Home',
      suggestion: 'Home',
      effective: 'Home',
      override: undefined,
      limit: 16,
      remediation: 'none',
    });
  });

  it('remediation "disambiguated" — second row with the same name gets a suffix', () => {
    const { lib, build } = dm32Fixture();
    lib.zones.push({ ...newZone(PROJECT_ID, 'Home'), projectId: PROJECT_ID });
    lib.zones.push({ ...newZone(PROJECT_ID, 'Home'), projectId: PROJECT_ID });
    const rows = resolveWireNames({
      build,
      library: librarySliceFrom(lib),
      entityKind: 'zone',
      formatId: DM32_FORMAT_ID,
      profileId: DM32_PROFILE_ID,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.remediation).toBe('none');
    expect(rows[0]!.effective).toBe('Home');
    expect(rows[1]!.remediation).toBe('disambiguated');
    expect(rows[1]!.effective).toBe('Home 2');
    expect(rows[1]!.suggestion).toBe('Home 2');
  });

  it('remediation "shortened" — over-limit name shortens via TalkGroup.abbreviation', () => {
    const { lib, build } = dm32Fixture();
    const tg = newTalkGroup(PROJECT_ID, 'A Very Long Talk Group Name Indeed', 12345);
    tg.abbreviation = 'AVLTGNI';
    lib.talkGroups.push({ ...tg, projectId: PROJECT_ID });
    const rows = resolveWireNames({
      build,
      library: librarySliceFrom(lib),
      entityKind: 'talkGroup',
      formatId: DM32_FORMAT_ID,
      profileId: DM32_PROFILE_ID,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.libraryName).toBe('A Very Long Talk Group Name Indeed');
    expect(rows[0]!.suggestion.length).toBeLessThanOrEqual(16);
    expect(rows[0]!.effective).toBe(rows[0]!.suggestion);
    expect(rows[0]!.remediation).toBe('shortened');
  });

  it('remediation "truncated" — build override longer than the profile limit is hard-cut', () => {
    const { lib, build } = dm32Fixture();
    const zone = { ...newZone(PROJECT_ID, 'Home'), projectId: PROJECT_ID };
    lib.zones.push(zone);
    const buildWithOverride: RadioBuild = {
      ...build,
      zoneOverrides: upsertOverride(build.zoneOverrides, zone.id, {
        wireName: 'This Override Is Definitely Too Long',
      }),
    };
    const rows = resolveWireNames({
      build: buildWithOverride,
      library: librarySliceFrom(lib),
      entityKind: 'zone',
      formatId: DM32_FORMAT_ID,
      profileId: DM32_PROFILE_ID,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.override).toBe('This Override Is Definitely Too Long');
    // Suggestion is pure — it never sees this row's own override.
    expect(rows[0]!.suggestion).toBe('Home');
    expect(rows[0]!.effective.length).toBeLessThanOrEqual(16);
    expect(rows[0]!.effective).not.toBe(rows[0]!.override);
    expect(rows[0]!.remediation).toBe('truncated');
  });

  it('kind "not_used" on this profile returns no rows (OpenGD77 has no scan lists)', () => {
    const { lib, build } = dm32Fixture();
    lib.zones.push({ ...newZone(PROJECT_ID, 'Home'), projectId: PROJECT_ID });
    // OpenGD77 profiles mark maxScanLists / nameLengthScanList 'not_used'.
    const rows = resolveWireNames({
      build,
      library: librarySliceFrom(lib),
      entityKind: 'scanList',
      formatId: 'opengd77',
      profileId: 'opengd77-1701',
    });
    expect(rows).toEqual([]);
  });

  it('null limit (unmodelled) passes the name through without shortening', () => {
    const { lib, build } = dm32Fixture();
    const longName = 'A Zone Name That Is Definitely Longer Than Sixteen Characters';
    lib.zones.push({ ...newZone(PROJECT_ID, longName), projectId: PROJECT_ID });
    // Every catalogued format/profile currently populates a real numeric nameLength for
    // every wire-name kind (see profileExportLimits.ts) — an unrecognised formatId is the
    // only way left to exercise the "getProfileExportLimits returns null" pass-through
    // branch this test targets.
    const rows = resolveWireNames({
      build,
      library: librarySliceFrom(lib),
      entityKind: 'zone',
      formatId: 'not-a-real-format',
      profileId: 'not-a-real-profile',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.limit).toBeUndefined();
    expect(rows[0]!.suggestion).toBe(longName);
    expect(rows[0]!.effective).toBe(longName);
    expect(rows[0]!.remediation).toBe('none');
  });

  it('suggestion is pure — never reflects this row’s own override', () => {
    const { lib, build } = dm32Fixture();
    const zone = { ...newZone(PROJECT_ID, 'Home'), projectId: PROJECT_ID };
    lib.zones.push(zone);
    const buildWithOverride: RadioBuild = {
      ...build,
      zoneOverrides: upsertOverride(build.zoneOverrides, zone.id, { wireName: 'Custom Name' }),
    };
    const rows = resolveWireNames({
      build: buildWithOverride,
      library: librarySliceFrom(lib),
      entityKind: 'zone',
      formatId: DM32_FORMAT_ID,
      profileId: DM32_PROFILE_ID,
    });
    expect(rows[0]!.suggestion).toBe('Home');
    expect(rows[0]!.override).toBe('Custom Name');
    expect(rows[0]!.effective).toBe('Custom Name');
  });

  it('has no format-id string literals in the resolver module', async () => {
    // Guard against reintroducing formatId === 'anytone' | 'opengd77' | ... branches.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.join(process.cwd(), 'src/core/services/resolveWireNames.ts');
    const source = fs.readFileSync(filePath, 'utf-8');
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    for (const literal of ["'anytone'", "'opengd77'", "'dm32'", "'chirp'", "'neonplug'"]) {
      expect(codeOnly.includes(literal)).toBe(false);
    }
  });
});

describe('classifyWireNameRemediation', () => {
  it('none — original already fits and nothing changed', () => {
    expect(
      classifyWireNameRemediation({
        original: 'Home',
        resolved: 'Home',
        limit: 16,
        isOverride: false,
      }),
    ).toBe('none');
  });

  it('disambiguated — original fit but a collision suffix was appended', () => {
    expect(
      classifyWireNameRemediation({
        original: 'Home',
        resolved: 'Home 2',
        limit: 16,
        isOverride: false,
      }),
    ).toBe('disambiguated');
  });

  it('shortened — original exceeded the limit, a suggestion was cut to fit', () => {
    expect(
      classifyWireNameRemediation({
        original: 'A Very Long Name Indeed',
        resolved: 'AVLNI',
        limit: 16,
        isOverride: false,
      }),
    ).toBe('shortened');
  });

  it('truncated — override exceeded the limit, hard-cut to fit', () => {
    expect(
      classifyWireNameRemediation({
        original: 'A Very Long Override Indeed',
        resolved: 'A Very Long Over',
        limit: 16,
        isOverride: true,
      }),
    ).toBe('truncated');
  });

  it('over_limit — even after remediation the resolved name still exceeds the limit', () => {
    // Unreachable via today’s lifted shorten/truncate primitives (they always hard-slice
    // to fit once a numeric limit is set) — this pins the classifier’s own contract for
    // a future primitive (e.g. a protected suffix wider than the whole budget) that can.
    expect(
      classifyWireNameRemediation({
        original: 'A Very Long Name Indeed',
        resolved: 'Still Too Long Name',
        limit: 16,
        isOverride: false,
      }),
    ).toBe('over_limit');
  });

  it('no limit (unmodelled) — dedupe only, never over_limit', () => {
    expect(
      classifyWireNameRemediation({
        original: 'Home',
        resolved: 'Home',
        limit: null,
        isOverride: false,
      }),
    ).toBe('none');
    expect(
      classifyWireNameRemediation({
        original: 'Home',
        resolved: 'Home 2',
        limit: null,
        isOverride: false,
      }),
    ).toBe('disambiguated');
  });
});
