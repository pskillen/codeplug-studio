import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild } from '@core/domain/factories.ts';
import { dedupeWarnings } from '@core/import-export/dedupeWarnings.ts';
import { exportBuildAll } from './exportBuild.ts';

describe('dedupeWarnings', () => {
  it('removes duplicate strings while preserving order', () => {
    expect(dedupeWarnings(['a', 'b', 'a', 'c', 'b']).map((warning) => warning)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('exportBuildAll', () => {
  it('returns each build-wide export warning once for multi-file OpenGD77 export', () => {
    const projectId = 'proj-warn-dedup';
    const longName = 'ThisChannelNameIsTooLong';
    const channel = { ...newChannel(projectId, longName), id: 'ch-1' };
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
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701'),
      channelOverrides: [{ libraryEntityId: channel.id, wireName: longName }],
    };
    const longNameWarningPrefix = `Channel wire name "${longName}" exceeds 16 characters`;

    const result = exportBuildAll({ build, library, fileName: 'Channels.csv' });

    expect(Object.keys(result.files).length).toBeGreaterThan(1);
    expect(
      result.warnings.filter((warning) => warning.startsWith(longNameWarningPrefix)),
    ).toHaveLength(1);
  });

  it('returns each build-wide DM32 zone cap warning once across all CSV files', () => {
    const projectId = 'proj-dm32-warn-dedup';
    const channels = Array.from({ length: 20 }, (_, index) => ({
      ...newChannel(projectId, `Channel ${index + 1}`),
      id: `ch-${index + 1}`,
    }));
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
    const build = newFormatBuild(projectId, 'dm32-baofeng-dm32uv');
    const capWarning = 'Zone "Glasgow" has 20 expanded members (scan cap 16)';

    const result = exportBuildAll({ build, library, fileName: 'Channels.csv' });

    expect(Object.keys(result.files).length).toBeGreaterThan(1);
    expect(result.warnings.filter((warning) => warning === capWarning)).toHaveLength(1);
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
      members: Array.from({ length: 20 }, (_, index) => ({
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
      members: Array.from({ length: 20 }, (_, index) => ({
        kind: 'channel' as const,
        channelId: `ch-b-${index + 1}`,
      })),
    };
    const channels = [
      ...Array.from({ length: 20 }, (_, index) => ({
        ...newChannel(projectId, `Glasgow ${index + 1}`),
        id: `ch-a-${index + 1}`,
      })),
      ...Array.from({ length: 20 }, (_, index) => ({
        ...newChannel(projectId, `Edinburgh ${index + 1}`),
        id: `ch-b-${index + 1}`,
      })),
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
    const build = newFormatBuild(projectId, 'dm32-baofeng-dm32uv');

    const result = exportBuildAll({ build, library, fileName: 'Channels.csv' });

    expect(result.warnings).toContain('Zone "Glasgow" has 20 expanded members (scan cap 16)');
    expect(result.warnings).toContain('Zone "Edinburgh" has 20 expanded members (scan cap 16)');
  });
});
