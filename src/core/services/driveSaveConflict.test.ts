import { describe, expect, it } from 'vitest';
import { buildDriveSaveConflict, evaluateDriveSaveConflictKinds } from './driveSaveConflict.ts';
import { buildProjectSyncDiff, type ProjectSyncSummary } from './projectSyncSummary.ts';

function summary(overrides: Partial<ProjectSyncSummary> = {}): ProjectSyncSummary {
  return {
    projectId: 'a',
    projectName: 'Demo',
    lastModifiedAt: 't0',
    portableSyncedAt: 't0',
    counts: {
      channels: 0,
      zones: 0,
      talkGroups: 0,
      digitalContacts: 0,
      analogContacts: 0,
      rxGroupLists: 0,
      scanLists: 0,
      aprsConfigurations: 0,
      radioBuilds: 0,
      egressPaths: 0,
    },
    ...overrides,
  };
}

const emptyDiff = buildProjectSyncDiff(summary(), summary());

describe('evaluateDriveSaveConflictKinds', () => {
  const localProjectId = '11111111-1111-4111-8111-111111111111';
  const remoteProjectId = '22222222-2222-4222-8222-222222222222';
  const localSyncedAt = '2026-07-09T10:00:00.000Z';

  it('returns empty when remote is not newer and ids match', () => {
    expect(
      evaluateDriveSaveConflictKinds({
        localProjectId,
        localSyncedAt,
        remoteProjectId: localProjectId,
        remoteModifiedAt: '2026-07-09T09:00:00.000Z',
      }),
    ).toEqual([]);
  });

  it('flags remoteNewer when Drive modifiedTime is after local sync', () => {
    expect(
      evaluateDriveSaveConflictKinds({
        localProjectId,
        localSyncedAt,
        remoteProjectId: localProjectId,
        remoteModifiedAt: '2026-07-09T12:00:00.000Z',
      }),
    ).toEqual(['remoteNewer']);
  });

  it('flags projectIdMismatch even when remote is older', () => {
    expect(
      evaluateDriveSaveConflictKinds({
        localProjectId,
        localSyncedAt,
        remoteProjectId,
        remoteModifiedAt: '2026-07-09T09:00:00.000Z',
      }),
    ).toEqual(['projectIdMismatch']);
  });

  it('flags both when remote is newer and ids differ', () => {
    expect(
      evaluateDriveSaveConflictKinds({
        localProjectId,
        localSyncedAt,
        remoteProjectId,
        remoteModifiedAt: '2026-07-09T12:00:00.000Z',
      }),
    ).toEqual(['remoteNewer', 'projectIdMismatch']);
  });
});

describe('buildDriveSaveConflict', () => {
  it('returns null for empty kinds', () => {
    expect(
      buildDriveSaveConflict([], {
        localProjectId: 'a',
        remoteProjectId: 'b',
        remoteModifiedAt: 't1',
        localSyncedAt: 't0',
        diff: emptyDiff,
        remoteYaml: '',
      }),
    ).toBeNull();
  });

  it('builds conflict payload when kinds are present', () => {
    expect(
      buildDriveSaveConflict(['remoteNewer'], {
        localProjectId: 'a',
        remoteProjectId: 'a',
        remoteModifiedAt: 't1',
        localSyncedAt: 't0',
        diff: emptyDiff,
        remoteYaml: 'yaml',
      }),
    ).toEqual({
      kinds: ['remoteNewer'],
      localProjectId: 'a',
      remoteProjectId: 'a',
      remoteModifiedAt: 't1',
      localSyncedAt: 't0',
      diff: emptyDiff,
      remoteYaml: 'yaml',
    });
  });
});
