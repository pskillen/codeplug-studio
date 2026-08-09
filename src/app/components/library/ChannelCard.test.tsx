import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import type { DataTableColumn } from '../v2/DataTable.tsx';
import type { Channel } from '@core/models/library.ts';
import { ProjectContext, type ProjectContextValue } from '../../state/ProjectContext.ts';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ChannelCard from './ChannelCard.tsx';

const CHANNEL = { ...newChannel('p1', 'Repeater 1', 'GB3TEST'), id: 'ch-1' };

const FIELD_COLUMNS: DataTableColumn<Channel>[] = [
  { key: 'band', header: 'Band', render: () => '2m' },
  { key: 'mode', header: 'Mode', render: (ch) => ch.callsign },
];

// ChannelListDeleteAction reads useLibrary() -> useProjects(), which throws
// without a ProjectContext ancestor. A null activeProjectId keeps useLibrary
// on its empty-library short-circuit — no persistence/IndexedDB involved.
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

function renderCard(props: { channel: Channel; fieldColumns: DataTableColumn<Channel>[] }) {
  return render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <ProjectContext.Provider value={NO_ACTIVE_PROJECT}>
          <ChannelCard {...props} />
        </ProjectContext.Provider>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

describe('ChannelCard', () => {
  it('renders the name link, a labeled row per field column, and the delete action', () => {
    renderCard({ channel: CHANNEL, fieldColumns: FIELD_COLUMNS });

    const nameLink = screen.getByRole('link', { name: 'Repeater 1' });
    expect(nameLink).toHaveAttribute('href', '/library/channels/ch-1');

    expect(screen.getByText('Band')).toBeInTheDocument();
    expect(screen.getByText('2m')).toBeInTheDocument();
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('GB3TEST')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Delete channel/ })).toBeInTheDocument();
  });

  it('renders no field rows when fieldColumns is empty', () => {
    renderCard({ channel: CHANNEL, fieldColumns: [] });

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Repeater 1' })).toBeInTheDocument();
  });

  it('falls back to an em dash when the channel has no name', () => {
    renderCard({ channel: { ...CHANNEL, name: '' }, fieldColumns: [] });

    expect(screen.getByRole('link', { name: '—' })).toBeInTheDocument();
  });
});
