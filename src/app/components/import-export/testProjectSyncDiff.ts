import {
  buildProjectSyncDiff,
  type ProjectSyncCounts,
  type ProjectSyncDiff,
  type ProjectSyncSummary,
} from '@core/services/projectSyncSummary.ts';

export interface TestProjectSyncSummaryOverrides {
  projectId?: string;
  projectName?: string;
  lastModifiedAt?: string | null;
  portableSyncedAt?: string | null;
  counts?: Partial<ProjectSyncCounts>;
}

/** Minimal sync summary for component / service tests. */
export function testProjectSyncSummary(
  overrides: TestProjectSyncSummaryOverrides = {},
): ProjectSyncSummary {
  const { counts, ...rest } = overrides;
  return {
    projectId: 'proj-1',
    projectName: 'Demo',
    lastModifiedAt: '2026-07-10T10:00:00.000Z',
    portableSyncedAt: '2026-07-10T09:00:00.000Z',
    ...rest,
    counts: {
      channels: 1,
      zones: 0,
      talkGroups: 0,
      digitalContacts: 0,
      analogContacts: 0,
      rxGroupLists: 0,
      scanLists: 0,
      aprsConfigurations: 0,
      radioBuilds: 0,
      egressPaths: 0,
      ...counts,
    },
  };
}

export function testProjectSyncDiff(
  localOverrides: TestProjectSyncSummaryOverrides = {},
  remoteOverrides: TestProjectSyncSummaryOverrides = {},
): ProjectSyncDiff {
  return buildProjectSyncDiff(
    testProjectSyncSummary(localOverrides),
    testProjectSyncSummary(remoteOverrides),
  );
}
