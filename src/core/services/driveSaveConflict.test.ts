import { describe, expect, it } from 'vitest';
import {
  buildDriveSaveConflict,
  evaluateDriveSaveConflictKinds,
} from './driveSaveConflict.ts';

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
        diffLines: [],
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
        diffLines: ['line'],
        remoteYaml: 'yaml',
      }),
    ).toEqual({
      kinds: ['remoteNewer'],
      localProjectId: 'a',
      remoteProjectId: 'a',
      remoteModifiedAt: 't1',
      localSyncedAt: 't0',
      diffLines: ['line'],
      remoteYaml: 'yaml',
    });
  });
});
