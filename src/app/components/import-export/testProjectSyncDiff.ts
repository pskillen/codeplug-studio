import {
  buildProjectSyncDiff,
  type ProjectSyncDiff,
  type ProjectSyncSummary,
} from '@core/services/projectSyncSummary.ts';

/** Minimal sync summary for component / service tests. */
export function testProjectSyncSummary(
  overrides: Partial<ProjectSyncSummary> & { counts?: Partial<ProjectSyncSummary['counts']> } = {},
): ProjectSyncSummary {
  return {
    projectId: 'proj-1',
    projectName: 'Demo',
    lastModifiedAt: '2026-07-10T10:00:00.000Z',
    portableSyncedAt: '2026-07-10T09:00:00.000Z',
    counts: {
      channels: 1,
      zones: 0,
      talkGroups: 0,
      digitalContacts: 0,
      analogContacts: 0,
      rxGroupLists: 0,
      scanLists: 0,
      aprsConfigurations: 0,
      formatBuilds: 0,
      ...overrides.counts,
    },
    ...overrides,
  };
}

export function testProjectSyncDiff(
  localOverrides: Parameters<typeof testProjectSyncSummary>[0] = {},
  remoteOverrides: Parameters<typeof testProjectSyncSummary>[0] = {},
): ProjectSyncDiff {
  return buildProjectSyncDiff(
    testProjectSyncSummary(localOverrides),
    testProjectSyncSummary(remoteOverrides),
  );
}
