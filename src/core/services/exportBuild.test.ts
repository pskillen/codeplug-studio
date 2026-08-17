import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { dedupeWarnings } from '@core/import-export/dedupeWarnings.ts';
import { formatExportWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import { exportBuildAll } from './exportBuild.ts';

function general(message: string): ExportWarning {
  return { kind: 'general', severity: 'problem', message };
}

describe('dedupeWarnings', () => {
  it('removes duplicate warnings while preserving order', () => {
    expect(
      dedupeWarnings([general('a'), general('b'), general('a'), general('c'), general('b')]).map(
        (warning) => formatExportWarning(warning),
      ),
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('exportBuildAll', () => {
  it('returns each build-wide export warning once for multi-file OpenGD77 export', () => {
    const projectId = 'proj-warn-dedup';
    const longName = 'ThisChannelNameIsTooLong';
    const channel = withExportEligibleDefaults({ ...newChannel(projectId, longName), id: 'ch-1' });
    const zone = {
      id: 'zone-1',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Glasgow',
      comment: '',
      members: [{ kind: 'channel' as const, channelId: channel.id }],
    };
    const library = {
      channels: [channel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const { build: baseBuild, egress } = newRadioBuildForProfile(projectId, 'opengd77-1701');
    const build = {
      ...baseBuild,
      channelOverrides: [{ libraryEntityId: channel.id, wireName: longName }],
    };
    const longNameWarningPrefix = `Channel wire name "${longName}" exceeds 16 characters`;

    const result = exportBuildAll({ build, egress, library });

    expect(Object.keys(result.files).length).toBeGreaterThan(1);
    expect(
      result.warnings.filter((warning) =>
        formatExportWarning(warning).startsWith(longNameWarningPrefix),
      ),
    ).toHaveLength(1);
    // Override path hard-truncates — warn without smart-shorten "exported as" wording.
    expect(
      result.warnings.some((warning) => formatExportWarning(warning).includes('exported as')),
    ).toBe(false);
    expect(
      result.warnings.some((warning) =>
        formatExportWarning(warning).startsWith(longNameWarningPrefix),
      ),
    ).toBe(true);
  });

  it('returns each build-wide DM32 zone cap warning once across all CSV files', () => {
    const projectId = 'proj-dm32-warn-dedup';
    const channels = Array.from({ length: 65 }, (_, index) =>
      withExportEligibleDefaults({
        ...newChannel(projectId, `Channel ${index + 1}`),
        id: `ch-${index + 1}`,
      }),
    );
    const zone = {
      id: 'zone-glasgow',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Glasgow',
      comment: '',
      members: channels.map((channel) => ({
        kind: 'channel' as const,
        channelId: channel.id,
      })),
    };
    const library = {
      channels,
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const { build, egress } = newRadioBuildForProfile(projectId, 'dm32-baofeng-dm32uv');

    const result = exportBuildAll({ build, egress, library });

    expect(Object.keys(result.files).length).toBeGreaterThan(1);
    expect(
      result.warnings.filter(
        (warning) =>
          warning.kind === 'member_cap' &&
          warning.capKind === 'zone-expanded-cap' &&
          warning.label === 'Glasgow' &&
          warning.count === 65 &&
          warning.cap === 64,
      ),
    ).toHaveLength(1);
  });

  it('keeps distinct warnings for different entities', () => {
    const projectId = 'proj-distinct-warnings';
    const zoneA = {
      id: 'zone-a',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Glasgow',
      comment: '',
      members: Array.from({ length: 65 }, (_, index) => ({
        kind: 'channel' as const,
        channelId: `ch-a-${index + 1}`,
      })),
    };
    const zoneB = {
      id: 'zone-b',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Edinburgh',
      comment: '',
      members: Array.from({ length: 65 }, (_, index) => ({
        kind: 'channel' as const,
        channelId: `ch-b-${index + 1}`,
      })),
    };
    const channels = [
      ...Array.from({ length: 65 }, (_, index) =>
        withExportEligibleDefaults({
          ...newChannel(projectId, `Glasgow ${index + 1}`),
          id: `ch-a-${index + 1}`,
        }),
      ),
      ...Array.from({ length: 65 }, (_, index) =>
        withExportEligibleDefaults({
          ...newChannel(projectId, `Edinburgh ${index + 1}`),
          id: `ch-b-${index + 1}`,
        }),
      ),
    ];
    const library = {
      channels,
      zones: [zoneA, zoneB],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const { build, egress } = newRadioBuildForProfile(projectId, 'dm32-baofeng-dm32uv');

    const result = exportBuildAll({ build, egress, library });

    expect(
      result.warnings.some(
        (warning) =>
          warning.kind === 'member_cap' &&
          warning.capKind === 'zone-expanded-cap' &&
          warning.label === 'Glasgow' &&
          warning.count === 65 &&
          warning.cap === 64,
      ),
    ).toBe(true);
    expect(
      result.warnings.some(
        (warning) =>
          warning.kind === 'member_cap' &&
          warning.capKind === 'zone-expanded-cap' &&
          warning.label === 'Edinburgh' &&
          warning.count === 65 &&
          warning.cap === 64,
      ),
    ).toBe(true);
  });
});
