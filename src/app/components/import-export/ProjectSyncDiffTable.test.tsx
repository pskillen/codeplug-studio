import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import {
  buildProjectSyncDiff,
  type ProjectSyncSummary,
} from '@core/services/projectSyncSummary.ts';
import ProjectSyncDiffTable from './ProjectSyncDiffTable.tsx';

function summary(
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

describe('ProjectSyncDiffTable', () => {
  it('renders timestamp and count rows with deltas', () => {
    const diff = buildProjectSyncDiff(
      summary(),
      summary({
        lastModifiedAt: '2026-07-11T10:00:00.000Z',
        counts: { channels: 3, aprsConfigurations: 1 },
      }),
    );

    render(
      <MantineProvider>
        <ProjectSyncDiffTable diff={diff} />
      </MantineProvider>,
    );

    expect(screen.getByText('Last edited')).toBeInTheDocument();
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('APRS configurations')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('remote newer')).toBeInTheDocument();
  });
});
