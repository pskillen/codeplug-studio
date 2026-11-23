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

function seed() {
  mocks.builds = [
    { ...newRadioBuildWithEgresses(projectId, 'baofeng-dm32uv-mm9pdy').build, name: 'Club A' },
    { ...newRadioBuildWithEgresses(projectId, 'retevis-rt95').build, name: 'Mobile' },
  ];
}

describe('BuildsListPage', () => {
  it('shows a card per radio, one New build button and no group switch', () => {
    seed();
    renderPage();
    expect(screen.getByText(/2 builds across 2 radios/)).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'DM-32UV builds' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /New build/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'List' })).not.toBeInTheDocument();
    expect(screen.queryByText('Group by')).not.toBeInTheDocument();
  });

  it('searches with a match count and an empty state', () => {
    seed();
    renderPage();
    const box = screen.getByRole('searchbox', { name: 'Search builds' });
    fireEvent.change(box, { target: { value: 'RETEVIS mobile' } });
    expect(screen.getByRole('status')).toHaveTextContent('1 match');
    expect(screen.queryByRole('article', { name: 'DM-32UV builds' })).not.toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'nothing here' } });
    expect(screen.getByText(/No builds match/)).toBeInTheDocument();
  });

  it('shows the empty state with no builds', () => {
    mocks.builds = [];
    renderPage();
    expect(screen.getByText('No builds yet')).toBeInTheDocument();
  });
});
