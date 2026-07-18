import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { buildProjectSyncDiff } from '@core/services/projectSyncSummary.ts';
import ProjectSyncDiffTable from './ProjectSyncDiffTable.tsx';
import { testProjectSyncSummary } from './testProjectSyncDiff.ts';

describe('ProjectSyncDiffTable', () => {
  it('renders timestamp and count rows with deltas', () => {
    const diff = buildProjectSyncDiff(
      testProjectSyncSummary(),
      testProjectSyncSummary({
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
