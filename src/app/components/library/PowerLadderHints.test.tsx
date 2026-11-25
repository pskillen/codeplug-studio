import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { newRadioBuildForProfile, newRadioBuildWithEgresses } from '@core/domain/factories.ts';
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
      builds: [newRadioBuildForProfile('p1', 'anytone-at-d890uv').build],
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

  it.each([
    [100, 'High ≈ 5 W'],
    [101, 'Turbo ≈ 7 W VHF / 6 W UHF'],
    [null, 'High ≈ 5 W (radio default)'],
  ])('renders power %s for an MM9PDY-only build', (power, hint) => {
    const { build } = newRadioBuildWithEgresses('p1', 'anytone-at-d890uv-mm9pdy');
    mockedUseFormatBuilds.mockReturnValue({ ...mockedUseFormatBuilds(), builds: [build] });

    render(
      <MantineProvider>
        <PowerLadderHints power={power} />
      </MantineProvider>,
    );
    expect(screen.getByText(`Anytone AT-D890UV (MM9PDY modded firmware): ${hint}`)).toBeVisible();
  });
});
