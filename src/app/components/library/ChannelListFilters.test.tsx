import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProjectContext, type ProjectContextValue } from '../../state/ProjectContext.ts';
import { OperatorPositionProvider } from '../../state/operatorPosition.tsx';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ChannelListFilters, { ChannelListAppliedFilters } from './ChannelListFilters.tsx';

const NO_ACTIVE_PROJECT: ProjectContextValue = {
  projects: [],
  activeProjectId: null,
  activeProject: null,
  loading: false,
  createProject: async () => undefined,
  switchProject: () => undefined,
  renameProject: async () => undefined,
  deleteProject: async () => undefined,
  refreshProjects: async () => undefined,
};

function renderFilters(initialEntry = '/library/channels') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DesignSystemV2Provider>
        <ProjectContext.Provider value={NO_ACTIVE_PROJECT}>
          <OperatorPositionProvider>
            <ChannelListFilters />
            <ChannelListAppliedFilters />
          </OperatorPositionProvider>
        </ProjectContext.Provider>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

async function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  await screen.findByText('All bands');
}

describe('ChannelListFilters', () => {
  it('shows the active tab chip set and hides the others', async () => {
    renderFilters();
    await openPopover();

    expect(screen.getByText('All bands')).toBeInTheDocument();
    expect(screen.queryByText('All zones')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Zones'));

    await waitFor(() => expect(screen.queryByText('All bands')).not.toBeInTheDocument());
    expect(screen.getByText('All zones')).toBeInTheDocument();
    expect(screen.getByText('Not in a zone')).toBeInTheDocument();
  });

  it('keeps the footer (Simplex/Split, distance) visible across tab switches', async () => {
    renderFilters();
    await openPopover();

    expect(screen.getByText('Simplex')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Modes'));

    await waitFor(() => expect(screen.queryByText('All bands')).not.toBeInTheDocument());
    expect(screen.getByText('Simplex')).toBeInTheDocument();
  });

  it('toggling a footer chip updates the query and shows an applied pill', async () => {
    renderFilters();
    await openPopover();

    fireEvent.click(screen.getByText('Simplex'));

    expect(await screen.findByText('1')).toBeInTheDocument(); // active-count badge
    // One "Simplex" is the SplitFilter button itself, the second is the applied pill.
    await waitFor(() => expect(screen.getAllByText('Simplex')).toHaveLength(2));
  });

  it('applied-pill remove clears exactly one filter and leaves the rest intact', async () => {
    renderFilters('/library/channels?duplex=simplex&distance=1&maxKm=50');

    const simplexPill = screen.getByText('Simplex').closest('span');
    const distancePill = screen.getByText('Within 50 km').closest('span');
    expect(simplexPill).not.toBeNull();
    expect(distancePill).not.toBeNull();

    fireEvent.click(within(simplexPill!).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(screen.queryByText('Simplex')).not.toBeInTheDocument());
    expect(screen.getByText('Within 50 km')).toBeInTheDocument();
  });

  it('active-count badge reflects the number of applied filters', async () => {
    renderFilters('/library/channels?duplex=simplex&distance=1&maxKm=50');

    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
