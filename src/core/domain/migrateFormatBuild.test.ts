import { describe, expect, it } from 'vitest';
import { normalizeFormatBuildFields } from './migrateFormatBuild.ts';
import { newFormatBuild } from './factories.ts';
import { overrideByEntityId } from './formatBuildOverrides.ts';

describe('normalizeFormatBuildFields', () => {
  it('defaults missing override arrays and layout', () => {
    const build = newFormatBuild('project-1', 'opengd77-1701');
    const legacy = {
      ...build,
      channelOverrides: undefined,
      zoneOverrides: undefined,
      talkGroupOverrides: undefined,
      rxGroupListOverrides: undefined,
      contactOverrides: undefined,
      layout: undefined,
    } as unknown as ReturnType<typeof newFormatBuild>;

    const normalized = normalizeFormatBuildFields(legacy);

    expect(normalized.channelOverrides).toEqual([]);
    expect(normalized.zoneOverrides).toEqual([]);
    expect(normalized.talkGroupOverrides).toEqual([]);
    expect(normalized.rxGroupListOverrides).toEqual([]);
    expect(normalized.contactOverrides).toEqual([]);
    expect(normalized.layout.sections).toEqual([]);
  });

  it('maps legacy channelSelections to channelOverrides', () => {
    const build = newFormatBuild('project-1', 'opengd77-1701');
    const legacy = {
      ...build,
      channelOverrides: undefined,
      channelSelections: [
        { libraryEntityId: 'ch-1', overrides: { name: 'Wire A' } },
      ],
    } as unknown as ReturnType<typeof newFormatBuild>;

    const normalized = normalizeFormatBuildFields(legacy);

    expect(normalized.channelOverrides).toEqual([
      { libraryEntityId: 'ch-1', wireName: 'Wire A' },
    ]);
  });
});

describe('overrideByEntityId', () => {
  it('treats undefined overrides as empty', () => {
    expect(overrideByEntityId(undefined).size).toBe(0);
  });
});
