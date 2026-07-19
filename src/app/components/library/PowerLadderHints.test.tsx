import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import PowerLadderHints from './PowerLadderHints.tsx';

vi.mock('../../state/useFormatBuilds.ts', () => ({
  useFormatBuilds: vi.fn(),
}));

import { useFormatBuilds } from '../../state/useFormatBuilds.ts';

const mockedUseFormatBuilds = vi.mocked(useFormatBuilds);

describe('PowerLadderHints', () => {
  beforeEach(() => {
    mockedUseFormatBuilds.mockReturnValue({
      projectId: 'p1',
      builds: [],
      loading: false,
      reload: vi.fn(),
      createBuild: vi.fn(),
      putBuild: vi.fn(),
      deleteBuild: vi.fn(),
    });
  });

  it('lists shipped profiles when the project has no builds', () => {
    render(
      <MantineProvider>
        <PowerLadderHints power={100} />
      </MantineProvider>,
    );
    expect(screen.getByText(/No builds yet/)).toBeInTheDocument();
    expect(screen.getByText(/Anytone AT-D890UV/)).toBeInTheDocument();
  });

  it('scopes to project builds when present', () => {
    mockedUseFormatBuilds.mockReturnValue({
      projectId: 'p1',
      builds: [
        {
          id: 'b1',
          projectId: 'p1',
          name: 'Anytone',
          formatId: 'anytone',
          profileId: 'anytone-at-d890uv',
          revision: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          layout: { sections: [] },
          channelOverrides: [],
          zoneOverrides: [],
          scanListOverrides: [],
          talkGroupOverrides: [],
          rxGroupListOverrides: [],
          contactOverrides: [],
        },
      ],
      loading: false,
      reload: vi.fn(),
      createBuild: vi.fn(),
      putBuild: vi.fn(),
      deleteBuild: vi.fn(),
    });

    render(
      <MantineProvider>
        <PowerLadderHints power={50} />
      </MantineProvider>,
    );
    expect(screen.getByText(/From this project/)).toBeInTheDocument();
    expect(screen.getByText(/Mid ≈ 2.5 W/)).toBeInTheDocument();
    expect(screen.queryByText(/Baofeng 1701/)).not.toBeInTheDocument();
  });
});
