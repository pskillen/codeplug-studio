import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildWithEgresses } from '@core/domain/factories.ts';
import BuildsListPage from './BuildsListPage.tsx';

const projectId = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({ builds: [] as unknown[] }));

vi.mock('../../state/useFormatBuilds.ts', () => ({
  useFormatBuilds: () => ({ builds: mocks.builds, loading: false }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <BuildsListPage />
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('BuildsListPage', () => {
  it('groups by manufacturer and model by default, with a List mode', () => {
    mocks.builds = [
      { ...newRadioBuildWithEgresses(projectId, 'baofeng-dm32uv-mm9pdy').build, name: 'Club A' },
      { ...newRadioBuildWithEgresses(projectId, 'retevis-rt95').build, name: 'Mobile' },
    ];
    renderPage();
    expect(screen.getByText(/2 builds across 2 radios/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baofeng builds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DM-32UV builds' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.queryByRole('button', { name: 'Baofeng builds' })).not.toBeInTheDocument();
    expect(screen.getByText('Club A')).toBeInTheDocument();
  });

  it('shows the empty state with no builds', () => {
    mocks.builds = [];
    renderPage();
    expect(screen.getByText('No builds yet')).toBeInTheDocument();
  });
});
